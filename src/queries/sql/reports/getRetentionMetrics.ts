import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type RetentionRow = {
  date: string;
  active_users: number;
  retention_rate: number;
};

export async function getRetentionMetrics(
  ...args: [websiteId: string, filters: QueryFilters, period: string, dateRange?: number]
): Promise<RetentionRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
  period: string,
  dateRange: number = 30,
): Promise<RetentionRow[]> {
  const { parseFilters, rawQuery } = prisma;
  const { filterQuery, cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: filters.eventType || 1, // Default to pageview
  });

  // Determine the date function based on period
  let dateFunction: string;
  switch (period) {
    case 'week':
      dateFunction = "date_trunc('week', created_at)";
      break;
    case 'month':
      dateFunction = "date_trunc('month', created_at)";
      break;
    default:
      dateFunction = "date_trunc('day', created_at)";
  }

  const result = await rawQuery(
    `
    select
      ${dateFunction} as date,
      count(distinct session_id) as active_users,
      round(count(distinct session_id) * 1.0, 2) as retention_rate
    from website_event
    ${cohortQuery}
    where website_id = {{websiteId::uuid}}
      and created_at between {{startDate}} and {{endDate}}
      and event_type = {{eventType}}
      ${filterQuery}
    group by ${dateFunction}
    order by date desc
    limit ${dateRange}
    `,
    params,
  );

  return result.map(row => ({
    date: row.date,
    active_users: Number(row.active_users) || 0,
    retention_rate: Number(row.retention_rate) || 0,
  }));
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
  period: string,
  dateRange: number = 30,
): Promise<RetentionRow[]> {
  const { parseFilters, rawQuery } = clickhouse;
  const { filterQuery, cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: filters.eventType || 1, // Default to pageview
  });

  // Determine the date function based on period
  let dateFunction: string;
  switch (period) {
    case 'week':
      dateFunction = 'toStartOfWeek(created_at)';
      break;
    case 'month':
      dateFunction = 'toStartOfMonth(created_at)';
      break;
    default:
      dateFunction = 'toDate(created_at)';
  }

  const result = (await rawQuery(
    `
    select
      ${dateFunction} as date,
      uniq(session_id) as active_users,
      round(uniq(session_id) * 1.0, 2) as retention_rate
    from website_event
    ${cohortQuery}
    where website_id = {websiteId:UUID}
      and created_at between {startDate:DateTime64} and {endDate:DateTime64}
      and event_type = {eventType:UInt32}
      ${filterQuery}
    group by ${dateFunction}
    order by date desc
    limit ${dateRange}
    `,
    params,
  )) as RetentionRow[];

  return (result as RetentionRow[]).map(row => ({
    date: row.date,
    active_users: Number(row.active_users) || 0,
    retention_rate: Number(row.retention_rate) || 0,
  }));
}
