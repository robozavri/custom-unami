import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type PageViewWithTotalsRow = {
  path: string;
  total_views: number;
  unique_visitors: number;
};

export async function getPageViewsWithTotals(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<PageViewWithTotalsRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<PageViewWithTotalsRow[]> {
  const { parseFilters, rawQuery } = prisma;

  const { cohortQuery, params } = await parseFilters(
    websiteId,
    {
      ...filters,
      eventType: 1, // pageView
    },
    { joinSession: false }, // We don't need session joins for this query
  );

  const pathSearch = filters?.url ? `and we.url_path like {{url}}` : '';

  const sql = `
    SELECT 
      we.url_path as path,
      COUNT(*) as total_views,
      COUNT(DISTINCT we.session_id) as unique_visitors
    FROM website_event we
    ${cohortQuery}
    WHERE we.website_id = {{websiteId::uuid}}
      AND we.created_at BETWEEN {{startDate}} AND {{endDate}}
      AND we.event_type = {{eventType}}
      ${pathSearch}
    GROUP BY we.url_path
    ORDER BY total_views DESC
  `;

  return rawQuery(sql, params);
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
): Promise<PageViewWithTotalsRow[]> {
  const { parseFilters, rawQuery } = clickhouse;
  const { cohortQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: 1, // pageView
  });

  const pathSearch = filters?.url ? `and we.url_path like {url:String}` : '';

  return rawQuery(
    `
    SELECT 
      we.url_path as path,
      COUNT(*) as total_views,
      uniq(we.session_id) as unique_visitors
    FROM website_event we
    ${cohortQuery}
    WHERE we.website_id = {websiteId:UUID}
      AND we.created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND we.event_type = {eventType:UInt32}
      ${pathSearch}
    GROUP BY we.url_path
    ORDER BY total_views DESC
    `,
    params,
  );
}
