import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

type Granularity = 'day' | 'week' | 'month';

export interface ArpuRevenueParams {
  websiteId: string;
  granularity: Granularity;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  timezone?: string; // reserved
  revenue_model?: 'net' | 'gross'; // currently same behavior
}

export interface ArpuRevenueRow {
  bucket_start: string; // 'YYYY-MM-DD'
  revenue: number; // summed revenue in bucket
}

export async function getArpuRevenueBuckets(params: ArpuRevenueParams): Promise<ArpuRevenueRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(params: ArpuRevenueParams): Promise<ArpuRevenueRow[]> {
  const { websiteId, granularity, date_from, date_to } = params;

  const trunc =
    granularity === 'week'
      ? "date_trunc('week', created_at)"
      : granularity === 'month'
      ? "date_trunc('month', created_at)"
      : "date_trunc('day', created_at)";

  const query = `
    SELECT
      to_char(${trunc}, 'YYYY-MM-DD') AS bucket_start,
      COALESCE(SUM(r.revenue), 0)::double precision AS revenue
    FROM revenue r
    WHERE r.website_id = $1::uuid
      AND r.created_at >= $2::timestamptz
      AND r.created_at < ($3::timestamptz + interval '1 day')
    GROUP BY bucket_start
    ORDER BY bucket_start ASC
  `;

  const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to);
  return result as ArpuRevenueRow[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
async function clickhouseQuery(params: ArpuRevenueParams): Promise<ArpuRevenueRow[]> {
  // TODO: Implement ClickHouse ARPU revenue aggregation
  void params;
  return [];
}
