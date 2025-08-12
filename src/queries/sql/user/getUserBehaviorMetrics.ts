import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type UserBehaviorRow = {
  user_id: string;
  total_sessions: number;
  total_page_views: number;
  first_view: Date;
  last_view: Date;
};

export async function getUserBehaviorMetrics(
  ...args: [
    websiteId: string,
    filters: QueryFilters,
    limit?: number | string,
    offset?: number | string,
  ]
): Promise<UserBehaviorRow[]> {
  // eslint-disable-next-line no-console
  console.log('getUserBehaviorMetrics: called with args:', args);

  try {
    const result = await runQuery({
      [PRISMA]: () => relationalQuery(...args),
      [CLICKHOUSE]: () => clickhouseQuery(...args),
    });

    // eslint-disable-next-line no-console
    console.log('getUserBehaviorMetrics: runQuery completed, result length:', result?.length || 0);

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getUserBehaviorMetrics: runQuery failed:', error);
    throw error;
  }
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
  limit: number | string = 50,
  offset: number | string = 0,
): Promise<UserBehaviorRow[]> {
  // eslint-disable-next-line no-console
  console.log('relationalQuery: starting with websiteId:', websiteId);

  const { parseFilters, rawQuery } = prisma;

  // eslint-disable-next-line no-console
  console.log('relationalQuery: calling parseFilters...');

  const { filterQuery, cohortQuery, joinSession, params } = await parseFilters(
    websiteId,
    {
      ...filters,
      eventType: 1,
    },
    { joinSession: true },
  );

  // eslint-disable-next-line no-console
  console.log('relationalQuery: parseFilters completed, params:', params);
  // eslint-disable-next-line no-console
  console.log('relationalQuery: executing rawQuery...');

  const result = await rawQuery(
    `
    select
      website_event.session_id as user_id,
      count(distinct website_event.session_id) as total_sessions,
      count(*) as total_page_views,
      min(website_event.created_at) as first_view,
      max(website_event.created_at) as last_view
    from website_event
    ${cohortQuery}
    ${joinSession}
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      and website_event.event_type = {{eventType}}
      ${filterQuery}
    group by website_event.session_id
    order by total_page_views desc
    limit ${limit}
    offset ${offset}
    `,
    params,
  );

  // eslint-disable-next-line no-console
  console.log('relationalQuery: rawQuery completed, result length:', result?.length || 0);

  return result;
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
  limit: number | string = 50,
  offset: number | string = 0,
): Promise<UserBehaviorRow[]> {
  const { parseFilters, rawQuery } = clickhouse;
  const { filterQuery, cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: 1,
  });

  return rawQuery(
    `
    select
      website_event.session_id as user_id,
      uniq(website_event.session_id) as total_sessions,
      count(*) as total_page_views,
      min(website_event.created_at) as first_view,
      max(website_event.created_at) as last_view
    from website_event
    ${cohortQuery}
    where website_event.website_id = {websiteId:UUID}
      and website_event.created_at between {startDate:DateTime64} and {endDate:DateTime64}
      and website_event.event_type = {eventType:UInt32}
      ${filterQuery}
    group by website_event.session_id
    order by total_page_views desc
    limit ${limit}
    offset ${offset}
    `,
    params,
  );
}
