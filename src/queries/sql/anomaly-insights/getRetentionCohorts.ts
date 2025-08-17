import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface RetentionCohortsParams {
  websiteId: string;
  period: 'day' | 'week' | 'month';
  date_from: string;
  date_to: string;
  timezone?: string;
  max_k?: number;
}

export interface CohortRow {
  cohort_start: string; // ISO start of cohort period (day/week/month bucket)
  k: number; // offset since cohort_start (0 for first period)
  active_users: bigint; // # users active in this period for this cohort (BigInt from database)
}

export async function getRetentionCohorts(params: RetentionCohortsParams): Promise<CohortRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(params: RetentionCohortsParams): Promise<CohortRow[]> {
  const { websiteId, period, date_from, date_to, max_k = 12 } = params;

  // Period truncation functions for PostgreSQL
  const periodTrunc = {
    day: "date_trunc('day', created_at)",
    week: "date_trunc('week', created_at)",
    month: "date_trunc('month', created_at)",
  }[period];

  // K calculation for PostgreSQL
  const kCalculation = {
    day: 'FLOOR(EXTRACT(EPOCH FROM (act.active_bucket - f.cohort_start)) / 86400)',
    week: 'FLOOR(EXTRACT(EPOCH FROM (act.active_bucket - f.cohort_start)) / (86400 * 7))',
    month:
      'FLOOR(EXTRACT(YEAR FROM age(act.active_bucket, f.cohort_start)) * 12 + EXTRACT(MONTH FROM age(act.active_bucket, f.cohort_start)))',
  }[period];

  const query = `
    WITH first_seen AS (
      SELECT
        session_id,
        ${periodTrunc} AS cohort_start
      FROM website_event
      WHERE website_id = $1::uuid
        AND created_at >= $2::timestamptz
        AND created_at < ($3::timestamptz + interval '1 day')
      GROUP BY session_id, ${periodTrunc}
    ),
    activity AS (
      SELECT
        session_id,
        ${periodTrunc} AS active_bucket
      FROM website_event
      WHERE website_id = $1::uuid
        AND created_at >= $2::timestamptz
        AND created_at < ($3::timestamptz + interval '1 day')
    ),
    joined AS (
      SELECT
        f.cohort_start,
        act.active_bucket,
        act.active_bucket - f.cohort_start AS delta,
        ${kCalculation}::int AS k
      FROM first_seen f
      JOIN activity act ON f.session_id = act.session_id
      WHERE act.active_bucket >= f.cohort_start
    )
    SELECT
      to_char(cohort_start, 'YYYY-MM-DD') AS cohort_start,
      k,
      COUNT(*) AS active_users
    FROM joined
    GROUP BY cohort_start, k
    HAVING k BETWEEN 0 AND $4
    ORDER BY cohort_start, k
  `;

  const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to, max_k);
  return result as CohortRow[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
async function clickhouseQuery(params: RetentionCohortsParams): Promise<CohortRow[]> {
  // ClickHouse implementation is pending
  // For now, throw error as ClickHouse implementation is not yet available
  // Note: ClickHouse has different schema and functions for date operations
  throw new Error('ClickHouse implementation not yet available for retention cohorts');
}
