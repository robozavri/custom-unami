import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export type Granularity = 'day' | 'week' | 'month';

export interface BounceRateParams {
  websiteId: string;
  granularity: Granularity;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  timezone?: string; // currently unused; default UTC semantics
}

export interface BounceRateRow {
  bucket_start: string; // ISO date (YYYY-MM-DD)
  visits: bigint; // total visits starting in bucket
  bounces: bigint; // single-page visits in bucket
}

export async function getBounceRateBuckets(params: BounceRateParams): Promise<BounceRateRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(params: BounceRateParams): Promise<BounceRateRow[]> {
  const { websiteId, granularity, date_from, date_to } = params;

  const trunc =
    granularity === 'week'
      ? "date_trunc('week', created_at)"
      : granularity === 'month'
      ? "date_trunc('month', created_at)"
      : "date_trunc('day', created_at)";

  const query = `
    WITH visits AS (
      SELECT
        visit_id,
        ${trunc} AS bucket_start
      FROM website_event
      WHERE website_id = $1::uuid
        AND event_type = 1
        AND created_at >= $2::timestamptz
        AND created_at < ($3::timestamptz + interval '1 day')
      GROUP BY visit_id, ${trunc}
    ),
    page_counts AS (
      SELECT
        we.visit_id,
        COUNT(*) AS page_count
      FROM website_event we
      JOIN visits v ON v.visit_id = we.visit_id
      WHERE we.website_id = $1::uuid
        AND we.event_type = 1
        AND we.created_at >= $2::timestamptz
        AND we.created_at < ($3::timestamptz + interval '1 day')
      GROUP BY we.visit_id
    )
    SELECT
      to_char(v.bucket_start, 'YYYY-MM-DD') AS bucket_start,
      COUNT(DISTINCT v.visit_id)::bigint AS visits,
      COUNT(DISTINCT v.visit_id) FILTER (WHERE pc.page_count = 1)::bigint AS bounces
    FROM visits v
    LEFT JOIN page_counts pc ON pc.visit_id = v.visit_id
    GROUP BY v.bucket_start
    ORDER BY v.bucket_start ASC
  `;

  const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to);
  return result as BounceRateRow[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
async function clickhouseQuery(params: BounceRateParams): Promise<BounceRateRow[]> {
  throw new Error('ClickHouse implementation not yet available for bounce rate');
}
