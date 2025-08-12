import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type PathTableRow = {
  path: string;
  visitors: number;
  views: number;
};

export async function getPathTable(
  websiteId: string,
  filters: QueryFilters,
  limit: number = 10,
): Promise<PathTableRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, filters, limit),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, filters, limit),
  });
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
  limit: number,
): Promise<PathTableRow[]> {
  const { parseFilters, rawQuery } = prisma;
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
    select
      website_event.url_path as path,
      count(distinct website_event.session_id) as visitors,
      count(*) as views
    from website_event
    ${cohortQuery}
    ${joinSession}
    where website_event.website_id = {{websiteId::uuid}}
      ${filters.startDate ? 'and website_event.created_at >= {{startDate}}' : ''}
      ${filters.endDate ? 'and website_event.created_at <= {{endDate}}' : ''}
      and website_event.event_type = {{eventType}}
      and website_event.url_path is not null
      ${filterQuery}
    group by website_event.url_path
    order by visitors desc
    limit ${limit}
    `,
    params,
  );

  return result.map((row: any) => ({
    path: row.path || '/',
    visitors: Number(row.visitors) || 0,
    views: Number(row.views) || 0,
  }));
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
  limit: number,
): Promise<PathTableRow[]> {
  const { parseFilters, rawQuery } = clickhouse;
  const { filterQuery, cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: filters.eventType || 1, // Default to pageview
  });

  const result = await rawQuery(
    `
    select
      website_event.url_path as path,
      uniq(website_event.session_id) as visitors,
      count(*) as views
    from website_event
    ${cohortQuery}
    where website_event.website_id = {websiteId:UUID}
      ${filters.startDate ? 'and website_event.created_at >= {startDate:DateTime64}' : ''}
      ${filters.endDate ? 'and website_event.created_at <= {endDate:DateTime64}' : ''}
      and website_event.event_type = {eventType:UInt32}
      and website_event.url_path is not null
      ${filterQuery}
    group by website_event.url_path
    order by visitors desc
    limit ${limit}
    `,
    params,
  );

  return result.map((row: any) => ({
    path: row.path || '/',
    visitors: Number(row.visitors) || 0,
    views: Number(row.views) || 0,
  }));
}
