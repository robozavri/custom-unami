import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface SegmentTotalsParams {
  websiteId: string;
  metric: 'visits' | 'pageviews' | 'bounce_rate';
  segment_by: 'country' | 'device' | 'browser' | 'referrer_domain' | 'utm_source' | 'path';
  date_from: string;
  date_to: string;
  timezone?: string;
  normalize_labels?: boolean;
}

export interface SegmentTotal {
  label: string;
  value: number;
}

export async function getSegmentTotals(params: SegmentTotalsParams): Promise<SegmentTotal[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(),
  });
}

async function relationalQuery(params: SegmentTotalsParams): Promise<SegmentTotal[]> {
  const { websiteId, metric, segment_by, date_from, date_to, normalize_labels = true } = params;

  // Segment column mapping - for PostgreSQL/MySQL, most fields come from session table
  const segmentColumn = {
    country: 's.country',
    device: 's.device',
    browser: 's.browser',
    referrer_domain: 'we.referrer_domain',
    utm_source: 'we.utm_source',
    path: 'we.url_path',
  }[segment_by];

  // Label normalization
  const labelNormalization = normalize_labels
    ? `CASE WHEN ${segmentColumn} IS NOT NULL THEN lower(${segmentColumn}) ELSE ${segmentColumn} END`
    : segmentColumn;

  let query: string;
  let queryParams: any[];

  if (metric === 'visits') {
    // Count distinct visit_id per segment - join with session for demographic data
    query = `
      SELECT
        ${labelNormalization} AS label,
        COUNT(DISTINCT we.visit_id)::bigint AS value
      FROM website_event we
      LEFT JOIN session s ON we.session_id = s.session_id
      WHERE we.website_id = $1::uuid
        AND we.created_at >= $2::timestamptz
        AND we.created_at < $3::timestamptz + interval '1 day'
        AND ${segmentColumn} IS NOT NULL
      GROUP BY ${segmentColumn}
      ORDER BY value DESC
    `;
    queryParams = [websiteId, date_from, date_to];
  } else if (metric === 'pageviews') {
    // Count pageview events per segment
    query = `
      SELECT
        ${labelNormalization} AS label,
        COUNT(*)::bigint AS value
      FROM website_event we
      LEFT JOIN session s ON we.session_id = s.session_id
      WHERE we.website_id = $1::uuid
        AND we.event_type = 1
        AND we.created_at >= $2::timestamptz
        AND we.created_at < $3::timestamptz + interval '1 day'
        AND ${segmentColumn} IS NOT NULL
      GROUP BY ${segmentColumn}
      ORDER BY value DESC
    `;
    queryParams = [websiteId, date_from, date_to];
  } else {
    // bounce_rate - count visits and bounces per segment
    query = `
      WITH visit_counts AS (
        SELECT
          ${labelNormalization} AS label,
          COUNT(DISTINCT we.visit_id)::bigint AS visits
        FROM website_event we
        LEFT JOIN session s ON we.session_id = s.session_id
        WHERE we.website_id = $1::uuid
          AND we.created_at >= $2::timestamptz
          AND we.created_at < $3::timestamptz + interval '1 day'
          AND ${segmentColumn} IS NOT NULL
        GROUP BY ${segmentColumn}
      ),
      bounce_counts AS (
        SELECT
          ${labelNormalization} AS label,
          COUNT(DISTINCT we.visit_id)::bigint AS bounces
        FROM (
          SELECT
            we.visit_id,
            ${labelNormalization} AS label,
            COUNT(*) AS page_count
          FROM website_event we
          LEFT JOIN session s ON we.session_id = s.session_id
          WHERE we.website_id = $1::uuid
            AND we.event_type = 1
            AND we.created_at >= $2::timestamptz
            AND we.created_at < $3::timestamptz + interval '1 day'
            AND ${segmentColumn} IS NOT NULL
          GROUP BY we.visit_id, ${segmentColumn}
          HAVING COUNT(*) = 1
        ) single_page_visits
        GROUP BY label
      )
      SELECT
        v.label,
        CASE 
          WHEN v.visits > 0 THEN (b.bounces::float / v.visits::float)::float
          ELSE 0.0
        END AS value
      FROM visit_counts v
      LEFT JOIN bounce_counts b ON v.label = b.label
      ORDER BY v.visits DESC
    `;
    queryParams = [websiteId, date_from, date_to];
  }

  const result = await prisma.client.$queryRawUnsafe(query, ...queryParams);
  return result as SegmentTotal[];
}

async function clickhouseQuery(): Promise<SegmentTotal[]> {
  // ClickHouse implementation is pending
  // For now, throw error as ClickHouse implementation is not yet available
  // Note: ClickHouse has different schema with country, device, browser directly in website_event
  throw new Error('ClickHouse implementation not yet available for segment totals');
}
