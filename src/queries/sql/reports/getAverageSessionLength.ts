import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

type Granularity = 'day' | 'week' | 'month';

export interface AverageSessionLengthParams {
  websiteId: string;
  granularity: Granularity;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  include_bounces?: boolean; // default true
  timezone?: string; // reserved
}

export interface AverageSessionLengthRow {
  bucket_start: string; // 'YYYY-MM-DD'
  sessions: bigint; // total sessions in bucket
  total_duration_s: bigint; // sum of durations (seconds)
}

export async function getAverageSessionLengthBuckets(
  params: AverageSessionLengthParams,
): Promise<AverageSessionLengthRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(
  params: AverageSessionLengthParams,
): Promise<AverageSessionLengthRow[]> {
  const { websiteId, granularity, date_from, date_to, include_bounces = true } = params;

  const trunc =
    granularity === 'week'
      ? "date_trunc('week', first_ts)"
      : granularity === 'month'
      ? "date_trunc('month', first_ts)"
      : "date_trunc('day', first_ts)";

  // Derive per-session first and last event timestamps within the window.
  // Treat sessions as grouped by session_id and only pageview events (event_type = 1) for duration.
  const query = `
    WITH per_session AS (
      SELECT
        we.session_id,
        MIN(we.created_at) AS first_ts,
        MAX(we.created_at) AS last_ts,
        COUNT(*) FILTER (WHERE we.event_type = 1) AS pageviews
      FROM website_event we
      WHERE we.website_id = $1::uuid
        AND we.event_type = 1
        AND we.created_at >= $2::timestamptz
        AND we.created_at < ($3::timestamptz + interval '1 day')
      GROUP BY we.session_id
    ),
    scored AS (
      SELECT
        ${trunc} AS bucket_start,
        GREATEST(0, EXTRACT(EPOCH FROM (last_ts - first_ts))::int) AS duration_s,
        pageviews
      FROM per_session
    ),
    filtered AS (
      SELECT *
      FROM scored
      WHERE $4::boolean = true OR pageviews > 1
    )
    SELECT
      to_char(bucket_start, 'YYYY-MM-DD') AS bucket_start,
      COUNT(*)::bigint AS sessions,
      SUM(duration_s)::bigint AS total_duration_s
    FROM filtered
    GROUP BY bucket_start
    ORDER BY bucket_start ASC
  `;

  const result = await prisma.client.$queryRawUnsafe(
    query,
    websiteId,
    date_from,
    date_to,
    include_bounces,
  );
  return result as AverageSessionLengthRow[];
}

async function clickhouseQuery(
  params: AverageSessionLengthParams,
): Promise<AverageSessionLengthRow[]> {
  // TODO: Implement ClickHouse query for average session length
  // This is a placeholder to avoid unused variable lint errors.
  void params;
  return [];
}
