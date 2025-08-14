import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type DetailedPageviewRow = {
  path: string;
  total_views: number;
  unique_visitors: number;
  total_sessions: number;
  avg_session_duration_seconds: number;
  avg_views_per_session: number;
  bounce_sessions: number;
};

export async function getDetailedPageviewMetrics(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<DetailedPageviewRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<DetailedPageviewRow[]> {
  const { parseFilters, rawQuery, getTimestampDiffSQL } = prisma;
  const { cohortQuery, joinSession, params } = await parseFilters(
    websiteId,
    {
      ...filters,
      eventType: 1, // pageView
    },
    { joinSession: true },
  );

  const pathSearch = filters?.url ? `and we.url_path like {{url}}` : '';

  return rawQuery(
    `
    with session_agg as (
      select
        we.url_path as path,
        we.visit_id,
        min(we.created_at) as first_view,
        max(we.created_at) as last_view,
        count(*) as views_in_session
      from website_event we
      ${cohortQuery}
      ${joinSession}
      where we.website_id = {{websiteId::uuid}}
        and we.created_at between {{startDate}} and {{endDate}}
        and we.event_type = {{eventType}}
        ${pathSearch}
      group by 1, 2
    )
    select
      we.url_path as path,
      count(*) as total_views,
      count(distinct we.session_id) as unique_visitors,
      count(distinct we.visit_id) as total_sessions,
      avg(${getTimestampDiffSQL('sa.first_view', 'sa.last_view')}) as avg_session_duration_seconds,
      avg(sa.views_in_session) as avg_views_per_session,
      count(distinct case when sa.views_in_session = 1 then we.visit_id end) as bounce_sessions
    from website_event we
    left join session_agg sa on sa.visit_id = we.visit_id and sa.path = we.url_path
    ${cohortQuery}
    ${joinSession}
    where we.website_id = {{websiteId::uuid}}
      and we.created_at between {{startDate}} and {{endDate}}
      and we.event_type = {{eventType}}
      ${pathSearch}
    group by we.url_path
    order by total_views desc
    `,
    params,
  );
}

// eslint-disable-next-line prettier/prettier
async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<DetailedPageviewRow[]> {
  const { parseFilters, rawQuery } = clickhouse;
  const { cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: 1, // pageView
  });

  const pathSearch = filters?.url ? `and we.url_path like {url:String}` : '';

  return rawQuery(
    `
    with session_agg as (
      select
        we.url_path as path,
        we.visit_id,
        min(we.created_at) as first_view,
        max(we.created_at) as last_view,
        count(*) as views_in_session
      from website_event we
      ${cohortQuery}
      where we.website_id = {websiteId:UUID}
        and we.created_at between {startDate:DateTime64} and {endDate:DateTime64}
        and we.event_type = {eventType:UInt32}
        ${pathSearch}
      group by path, we.visit_id
    )
    select
      we.url_path as path,
      count(*) as total_views,
      uniq(we.session_id) as unique_visitors,
      uniq(we.visit_id) as total_sessions,
      avg(sa.last_view - sa.first_view) as avg_session_duration_seconds,
      avg(sa.views_in_session) as avg_views_per_session,
      uniqIf(we.visit_id, sa.views_in_session = 1) as bounce_sessions
    from website_event we
    left join session_agg sa on sa.visit_id = we.visit_id and sa.path = we.url_path
    ${cohortQuery}
    where we.website_id = {websiteId:UUID}
      and we.created_at between {startDate:DateTime64} and {endDate:DateTime64}
      and we.event_type = {eventType:UInt32}
      ${pathSearch}
    group by we.url_path
    order by total_views desc
    `,
    params,
  );
}
