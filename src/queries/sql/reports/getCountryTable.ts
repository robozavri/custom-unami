import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import { QueryFilters } from '@/lib/types';

export type CountryTableRow = {
  country: string;
  visitors: number;
  views: number;
};

export async function getCountryTable(
  websiteId: string,
  filters: QueryFilters,
  limit: number = 10,
): Promise<CountryTableRow[]> {
  const result = await runQuery({
    [PRISMA]: () => relationalQuery(websiteId, filters, limit),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, filters, limit),
  });

  return result;
}

async function relationalQuery(
  websiteId: string,
  filters: QueryFilters,
  limit: number,
): Promise<CountryTableRow[]> {
  // console.log('🔍 relationalQuery called with:', { websiteId, filters, limit });

  const { parseFilters, rawQuery } = prisma;
  const { filterQuery, cohortQuery, dateQuery, params } = await parseFilters(
    websiteId,
    {
      ...filters,
      eventType: filters.eventType || 1, // Default to pageview
    },
    { joinSession: true },
  );

  // console.log('🔍 parseFilters result:', { filterQuery, cohortQuery, dateQuery, params });

  // DEBUG: First check what data exists without filters
  // console.log('🔍 DEBUG: Checking raw data without filters...');
  // const debugResult = await rawQuery(
  //   `
  //   select
  //     count(*) as total_events,
  //     count(distinct website_event.session_id) as total_sessions,
  //     min(website_event.created_at) as earliest_date,
  //     max(website_event.created_at) as latest_date,
  //     count(distinct website_event.event_type) as event_types
  //   from website_event
  //   where website_event.website_id = {{websiteId::uuid}}
  //   `,
  //   { websiteId },
  // );
  // console.log('🔍 DEBUG: Raw data summary:', debugResult);

  // DEBUG: Check session data
  // console.log('🔍 DEBUG: Checking session data...');
  // const sessionDebug = await rawQuery(
  //   `
  //   select
  //     count(*) as total_sessions,
  //     count(case when country is not null then 1 end) as sessions_with_country,
  //     count(case when country is not null and country != '' then 1 end) as sessions_with_nonempty_country
  //   from session
  //   where website_id = {{websiteId::uuid}}
  //   `,
  //   { websiteId },
  // );
  // console.log('🔍 DEBUG: Session data summary:', sessionDebug);

  // DEBUG: Check what event types exist
  // console.log('🔍 DEBUG: Checking event types...');
  // const eventTypeDebug = await rawQuery(
  //   `
  //   select
  //     event_type,
  //     count(*) as count
  //   from website_event
  //   where website_id = {{websiteId::uuid}}
  //   group by event_type
  //   order by event_type
  //   `,
  //   { websiteId },
  // );
  // console.log('🔍 DEBUG: Event types in database:', eventTypeDebug);

  // DEBUG: Test country query without date filters
  // console.log('🔍 DEBUG: Testing country query without date filters...');
  // const countryDebug = await rawQuery(
  //   `
  //   select
  //     session.country as country,
  //     count(distinct website_event.session_id) as visitors,
  //     count(*) as views
  //   from website_event
  //   inner join session on website_event.session_id = session.session_id
  //   where website_event.website_id = {{websiteId::uuid}}
  //     and website_event.event_type = 1
  //     and session.country is not null
  //     and session.country != ''
  //   group by session.country
  //   order by visitors desc
  //   limit 5
  //   `,
  //   { websiteId },
  // );
  // console.log('🔍 DEBUG: Country query without date filters result:', countryDebug);

  const sql = `
    select
      session.country as country,
      count(distinct website_event.session_id) as visitors,
      count(*) as views
    from website_event
    inner join session on website_event.session_id = session.session_id
    ${cohortQuery}
    where website_event.website_id = {{websiteId::uuid}}
      ${dateQuery}
      and website_event.event_type = {{eventType}}
      and session.country is not null
      and session.country != ''
      ${filterQuery}
    group by session.country
    order by visitors desc
    limit ${limit}
  `;

  // console.log('🔍 SQL Query:', sql);
  // console.log('🔍 SQL Params:', params);

  const result = await rawQuery(sql, params);
  // console.log('🔍 Raw query result:', result);

  const mappedResult = (result as any[]).map((row: any) => ({
    country: row.country || 'Unknown',
    visitors: Number(row.visitors) || 0,
    views: Number(row.views) || 0,
  }));

  // console.log('🔍 Mapped result:', mappedResult);
  return mappedResult;
}

async function clickhouseQuery(
  websiteId: string,
  filters: QueryFilters,
  limit: number,
): Promise<CountryTableRow[]> {
  // console.log('🔍 clickhouseQuery called with:', { websiteId, filters, limit });

  const { parseFilters, rawQuery } = clickhouse;
  const { filterQuery, cohortQuery, dateQuery, params } = await parseFilters(websiteId, {
    ...filters,
    eventType: filters.eventType || 1, // Default to pageview
  });

  // console.log('🔍 ClickHouse parseFilters result:', {
  // filterQuery,
  // cohortQuery,
  // dateQuery,
  // params,
  // });

  const sql = `
    select
      website_event.country as country,
      uniq(website_event.session_id) as visitors,
      count(*) as views
    from website_event
    ${cohortQuery}
    where website_event.website_id = {websiteId:UUID}
      ${dateQuery}
      and website_event.event_type = {eventType:UInt32}
      and website_event.country is not null
      and website_event.country != ''
      ${filterQuery}
    group by website_event.country
    order by visitors desc
    limit ${limit}
  `;

  // console.log('🔍 ClickHouse SQL Query:', sql);
  // console.log('🔍 ClickHouse SQL Params:', params);

  const result = await rawQuery(sql, params);
  // console.log('🔍 ClickHouse raw query result:', result);

  const mappedResult = (result as any[]).map((row: any) => ({
    country: row.country || 'Unknown',
    visitors: Number(row.visitors) || 0,
    views: Number(row.views) || 0,
  }));

  // console.log('🔍 ClickHouse mapped result:', mappedResult);
  return mappedResult;
}
