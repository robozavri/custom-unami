import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

type Granularity = 'day' | 'week' | 'month';

export interface ArpuDenominatorParams {
  websiteId: string;
  granularity: Granularity;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  model: 'active_users' | 'paying_users';
  timezone?: string;
}

export interface ArpuDenominatorRow {
  bucket_start: string; // 'YYYY-MM-DD'
  user_count: number;
}

export async function getArpuDenominatorBuckets(
  params: ArpuDenominatorParams,
): Promise<ArpuDenominatorRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(params: ArpuDenominatorParams): Promise<ArpuDenominatorRow[]> {
  const { websiteId, granularity, date_from, date_to, model } = params;

  const trunc =
    granularity === 'week'
      ? "date_trunc('week', created_at)"
      : granularity === 'month'
      ? "date_trunc('month', created_at)"
      : "date_trunc('day', created_at)";

  if (model === 'active_users') {
    const query = `
      SELECT
        to_char(${trunc}, 'YYYY-MM-DD') AS bucket_start,
        COUNT(DISTINCT we.session_id)::double precision AS user_count
      FROM website_event we
      WHERE we.website_id = $1::uuid
        AND we.created_at >= $2::timestamptz
        AND we.created_at < ($3::timestamptz + interval '1 day')
      GROUP BY bucket_start
      ORDER BY bucket_start ASC
    `;
    const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to);
    return result as ArpuDenominatorRow[];
  }

  // paying_users: distinct sessions with a charge in revenue table
  const query = `
    SELECT
      to_char(${trunc}, 'YYYY-MM-DD') AS bucket_start,
      COUNT(DISTINCT r.session_id)::double precision AS user_count
    FROM revenue r
    WHERE r.website_id = $1::uuid
      AND r.revenue > 0
      AND r.created_at >= $2::timestamptz
      AND r.created_at < ($3::timestamptz + interval '1 day')
    GROUP BY bucket_start
    ORDER BY bucket_start ASC
  `;
  const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to);
  return result as ArpuDenominatorRow[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
async function clickhouseQuery(params: ArpuDenominatorParams): Promise<ArpuDenominatorRow[]> {
  // TODO: Implement ClickHouse ARPU denominators aggregation
  void params;
  return [];
}
