/* eslint-disable prettier/prettier */
import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type WebAnalyticsBreakdownRow = {
  time_period: string;
  unique_visitors: number;
  page_views: number;
  unique_sessions: number;
};

export type WebAnalyticsBreakdownResult = {
  unique_visitors: WebAnalyticsBreakdownRow[];
  page_views: WebAnalyticsBreakdownRow[];
  unique_sessions: WebAnalyticsBreakdownRow[];
};

export async function getWebAnalyticsBreakdown(
  websiteId: string,
  filters: QueryFilters,
  groupBy: 'hour' | 'day' | 'week' | 'month',
): Promise<WebAnalyticsBreakdownResult> {
  const result = await runQuery({
    [PRISMA]: () => relationalQuery(websiteId, filters, groupBy),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, filters, groupBy),
  });

  return result;
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
  groupBy: 'hour' | 'day' | 'week' | 'month',
): Promise<WebAnalyticsBreakdownResult> {
  const { parseFilters, rawQuery } = prisma;
  const { filterQuery, cohortQuery, joinSession, dateQuery, params } = await parseFilters(
    websiteId,
    {
      ...filters,
      eventType: filters.eventType || 1, // Default to pageview
    },
    { joinSession: true },
  );

  // Determine the time grouping function based on groupBy parameter
  let timeGrouping: string;
  switch (groupBy) {
    case 'hour':
      timeGrouping = "date_trunc('hour', website_event.created_at)";
      break;
    case 'day':
      timeGrouping = "date_trunc('day', website_event.created_at)";
      break;
    case 'week':
      timeGrouping = "date_trunc('week', website_event.created_at)";
      break;
    case 'month':
      timeGrouping = "date_trunc('month', website_event.created_at)";
      break;
    default:
      timeGrouping = "date_trunc('day', website_event.created_at)";
  }

  const result = await rawQuery(
    `
    select
      ${timeGrouping} as time_period,
      count(distinct website_event.session_id) as unique_visitors,
      count(*) as page_views,
      count(distinct website_event.session_id) as unique_sessions
    from website_event
    ${cohortQuery}
    ${joinSession}
    where website_event.website_id = {{websiteId::uuid}}
      ${dateQuery}
      and website_event.event_type = {{eventType}}
      ${filterQuery}
    group by time_period
    order by time_period desc
    `,
    params,
  );

  // Ensure result is an array before calling map
  const rows = Array.isArray(result) ? result : [];
  const formattedResults = rows.map((row: any) => ({
    time_period: row.time_period ? new Date(row.time_period).toISOString() : '',
    unique_visitors: Number(row.unique_visitors) || 0,
    page_views: Number(row.page_views) || 0,
    unique_sessions: Number(row.unique_sessions) || 0,
  }));

  return {
    unique_visitors: formattedResults,
    page_views: formattedResults,
    unique_sessions: formattedResults,
  };
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
  groupBy: 'hour' | 'day' | 'week' | 'month',
): Promise<WebAnalyticsBreakdownResult> {
  const { parseFilters, rawQuery } = clickhouse;
  const { filterQuery, cohortQuery, dateQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: filters.eventType || 1, // Default to pageview
  });

  // Determine the time grouping function based on groupBy parameter
  let timeGrouping: string;
  switch (groupBy) {
    case 'hour':
      timeGrouping = 'toStartOfHour(website_event.created_at)';
      break;
    case 'day':
      timeGrouping = 'toDate(website_event.created_at)';
      break;
    case 'week':
      timeGrouping = 'toStartOfWeek(website_event.created_at)';
      break;
    case 'month':
      timeGrouping = 'toStartOfMonth(website_event.created_at)';
      break;
    default:
      timeGrouping = 'toDate(website_event.created_at)';
  }

  const result = await rawQuery(
    `
    select
      ${timeGrouping} as time_period,
      uniq(website_event.session_id) as unique_visitors,
      count(*) as page_views,
      uniq(website_event.session_id) as unique_sessions
    from website_event
    ${cohortQuery}
    where website_event.website_id = {websiteId:UUID}
      ${dateQuery}
      and website_event.event_type = {eventType:UInt32}
      ${filterQuery}
    group by time_period
    order by time_period desc
    `,
    params,
  );

  // Ensure result is an array before calling map
  const rows = Array.isArray(result) ? result : [];
  const formattedResults = rows.map((row: any) => ({
    time_period: row.time_period ? new Date(row.time_period).toISOString() : '',
    unique_visitors: Number(row.unique_visitors) || 0,
    page_views: Number(row.page_views) || 0,
    unique_sessions: Number(row.unique_sessions) || 0,
  }));

  return {
    unique_visitors: formattedResults,
    page_views: formattedResults,
    unique_sessions: formattedResults,
  };
}
