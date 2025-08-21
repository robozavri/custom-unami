import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type WebStatisticsRow = {
  visitors: number;
  page_views: number;
  sessions: number;
  avg_session_duration_seconds: number;
  bounce_sessions: number;
};

export async function getWebStatistics(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<WebStatisticsRow> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebStatisticsRow> {
  const { parseFilters, rawQuery, getTimestampDiffSQL } = prisma;
  const { filterQuery, cohortQuery, joinSession, params } = await parseFilters(
    websiteId,
    {
      ...filters,
      eventType: filters.eventType || 1, // Default to pageview
    },
    { joinSession: true },
  );

  const result = await rawQuery(
    `
    with session_stats as (
      select
        session_id,
        count(*) as views_count,
        ${getTimestampDiffSQL('min(created_at)', 'max(created_at)')} as session_duration
      from website_event
      where website_id = {{websiteId::uuid}}
        and created_at between {{startDate}} and {{endDate}}
        and event_type = {{eventType}}
      group by session_id
    )
    select
      count(distinct website_event.session_id) as visitors,
      count(*) as page_views,
      count(distinct website_event.session_id) as sessions,
      coalesce(avg(ss.session_duration), 0) as avg_session_duration_seconds,
      count(distinct case when ss.views_count = 1 then website_event.session_id end) as bounce_sessions
    from website_event
    left join session_stats ss on ss.session_id = website_event.session_id
    ${cohortQuery}
    ${joinSession}
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type = {{eventType}}
      ${filterQuery}
    `,
    params,
  );

  const row = result[0] || {};
  return {
    visitors: Number(row.visitors) || 0,
    page_views: Number(row.page_views) || 0,
    sessions: Number(row.sessions) || 0,
    avg_session_duration_seconds: Number(row.avg_session_duration_seconds) || 0,
    bounce_sessions: Number(row.bounce_sessions) || 0,
  };
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<WebStatisticsRow> {
  const { parseFilters, rawQuery } = clickhouse;
  const { filterQuery, cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: filters.eventType || 1, // Default to pageview
  });

  const result = await rawQuery(
    `
    select
      uniq(website_event.session_id) as visitors,
      count(*) as page_views,
      uniq(website_event.session_id) as sessions,
      avg(session_views.last_view - session_views.first_view) as avg_session_duration_seconds,
      uniqIf(website_event.session_id, session_views.views_count = 1) as bounce_sessions
    from website_event
    left join (
      select 
        session_id,
        count(*) as views_count,
        min(created_at) as first_view,
        max(created_at) as last_view
      from website_event 
      where website_id = {websiteId:UUID}
        and created_at between {startDate:DateTime64} and {endDate:DateTime64}
        and event_type = {eventType:UInt32}
      group by session_id
    ) session_views on session_views.session_id = website_event.session_id
    ${cohortQuery}
    where website_event.website_id = {websiteId:UUID}
      and website_event.created_at between {startDate:DateTime64} and {endDate:DateTime64}
      and website_event.event_type = {eventType:UInt32}
      ${filterQuery}
    `,
    params,
  );

  const row = result[0] || {};
  return {
    visitors: Number(row.visitors) || 0,
    page_views: Number(row.page_views) || 0,
    sessions: Number(row.sessions) || 0,
    avg_session_duration_seconds: Number(row.avg_session_duration_seconds) || 0,
    bounce_sessions: Number(row.bounce_sessions) || 0,
  };
}
