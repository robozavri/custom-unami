import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface SourceComparisonData {
  source: string;
  current: {
    conversions: number;
    uniqueVisitors: number;
    conversionRate: number;
  };
  previous: {
    conversions: number;
    uniqueVisitors: number;
    conversionRate: number;
  };
}

export async function getSourceComparisonData(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number = 5,
): Promise<SourceComparisonData[]> {
  return runQuery({
    [PRISMA]: () =>
      relationalQuery(
        websiteId,
        conversionEvent,
        currentFrom,
        currentTo,
        previousFrom,
        previousTo,
        minVisitors,
      ),
    [CLICKHOUSE]: () =>
      clickhouseQuery(
        websiteId,
        conversionEvent,
        currentFrom,
        currentTo,
        previousFrom,
        previousTo,
        minVisitors,
      ),
  });
}

async function relationalQuery(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number,
): Promise<SourceComparisonData[]> {
  // eslint-disable-next-line no-console
  console.log('🔍 [relationalQuery] START with params:', {
    websiteId,
    conversionEvent,
    currentFrom,
    currentTo,
    previousFrom,
    previousTo,
    minVisitors,
  });

  const { rawQuery } = prisma;

  try {
    // Get current period data by source
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Executing current period query...');
    const currentResult = await rawQuery(
      `
      SELECT
        COALESCE(e.referrer_domain, 'direct') AS source,
        COUNT(DISTINCT e.session_id) AS conversions,
        COUNT(DISTINCT s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY e.referrer_domain
      HAVING COUNT(DISTINCT s.distinct_id) >= {{minVisitors}}
      ORDER BY unique_visitors DESC
      `,
      { websiteId, conversionEvent, currentFrom, currentTo, minVisitors },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Current period result:', currentResult);

    // Get previous period data by source
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Executing previous period query...');
    const previousResult = await rawQuery(
      `
      SELECT
        COALESCE(e.referrer_domain, 'direct') AS source,
        COUNT(DISTINCT e.session_id) AS conversions,
        COUNT(DISTINCT s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY e.referrer_domain
      HAVING COUNT(DISTINCT s.distinct_id) >= {{minVisitors}}
      ORDER BY unique_visitors DESC
      `,
      { websiteId, conversionEvent, previousFrom, previousTo, minVisitors },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Previous period result:', previousResult);

    // Create maps for easy lookup
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    currentResult.forEach((row: any) => {
      currentMap.set(row.source, row);
    });

    previousResult.forEach((row: any) => {
      previousMap.set(row.source, row);
    });

    // Get all unique sources
    const allSources = new Set([...currentMap.keys(), ...previousMap.keys()]);

    // Build result array
    const result: SourceComparisonData[] = [];
    for (const source of allSources) {
      const current = currentMap.get(source);
      const previous = previousMap.get(source);

      // Skip if both periods have insufficient visitors
      if (
        (!current || Number(current.unique_visitors) < minVisitors) &&
        (!previous || Number(previous.unique_visitors) < minVisitors)
      ) {
        continue;
      }

      const currentConversions = current ? Number(current.conversions) : 0;
      const currentVisitors = current ? Number(current.unique_visitors) : 0;
      const previousConversions = previous ? Number(previous.conversions) : 0;
      const previousVisitors = previous ? Number(previous.unique_visitors) : 0;

      result.push({
        source,
        current: {
          conversions: currentConversions,
          uniqueVisitors: currentVisitors,
          conversionRate:
            currentVisitors > 0
              ? Number(((currentConversions / currentVisitors) * 100).toFixed(4))
              : 0,
        },
        previous: {
          conversions: previousConversions,
          uniqueVisitors: previousVisitors,
          conversionRate:
            previousVisitors > 0
              ? Number(((previousConversions / previousVisitors) * 100).toFixed(4))
              : 0,
        },
      });
    }

    // Sort by absolute change in conversion rate
    result.sort((a, b) => {
      const aChange = Math.abs(a.current.conversionRate - a.previous.conversionRate);
      const bChange = Math.abs(b.current.conversionRate - b.previous.conversionRate);
      return bChange - aChange;
    });

    // eslint-disable-next-line no-console
    console.log('✅ [relationalQuery] SUCCESS - returning result:', result);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ [relationalQuery] ERROR:', error);
    throw error;
  }
}

async function clickhouseQuery(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number,
): Promise<SourceComparisonData[]> {
  // eslint-disable-next-line no-console
  console.log('🔍 [clickhouseQuery] START with params:', {
    websiteId,
    conversionEvent,
    currentFrom,
    currentTo,
    previousFrom,
    previousTo,
    minVisitors,
  });

  const { rawQuery } = clickhouse;

  try {
    // Get current period data by source
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Executing current period query...');
    const currentResult = await rawQuery(
      `
      SELECT
        COALESCE(e.referrer_domain, 'direct') AS source,
        uniq(e.session_id) AS conversions,
        uniq(s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {websiteId:UUID}
        AND e.event_name = {conversionEvent:String}
        AND e.created_at BETWEEN parseDateTime64BestEffort({currentFrom:String}) AND parseDateTime64BestEffort({currentTo:String})
      GROUP BY e.referrer_domain
      HAVING unique_visitors >= {minVisitors:UInt32}
      ORDER BY unique_visitors DESC
      `,
      { websiteId, conversionEvent, currentFrom, currentTo, minVisitors },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Current period result:', currentResult);

    // Get previous period data by source
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Executing previous period query...');
    const previousResult = await rawQuery(
      `
      SELECT
        COALESCE(e.referrer_domain, 'direct') AS source,
        uniq(e.session_id) AS conversions,
        uniq(s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {websiteId:UUID}
        AND e.event_name = {conversionEvent:String}
        AND e.created_at BETWEEN parseDateTime64BestEffort({previousFrom:String}) AND parseDateTime64BestEffort({previousTo:String})
      GROUP BY e.referrer_domain
      HAVING unique_visitors >= {minVisitors:UInt32}
      ORDER BY unique_visitors DESC
      `,
      { websiteId, conversionEvent, previousFrom, previousTo, minVisitors },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Previous period result:', previousResult);

    // Create maps for easy lookup
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    (Array.isArray(currentResult) ? currentResult : []).forEach((row: any) => {
      currentMap.set(row.source, row);
    });

    (Array.isArray(previousResult) ? previousResult : []).forEach((row: any) => {
      previousMap.set(row.source, row);
    });

    // Get all unique sources
    const allSources = new Set([...currentMap.keys(), ...previousMap.keys()]);

    // Build result array
    const result: SourceComparisonData[] = [];
    for (const source of allSources) {
      const current = currentMap.get(source);
      const previous = previousMap.get(source);

      // Skip if both periods have insufficient visitors
      if (
        (!current || Number(current.unique_visitors) < minVisitors) &&
        (!previous || Number(previous.unique_visitors) < minVisitors)
      ) {
        continue;
      }

      const currentConversions = current ? Number(current.conversions) : 0;
      const currentVisitors = current ? Number(current.unique_visitors) : 0;
      const previousConversions = previous ? Number(previous.conversions) : 0;
      const previousVisitors = previous ? Number(previous.unique_visitors) : 0;

      result.push({
        source,
        current: {
          conversions: currentConversions,
          uniqueVisitors: currentVisitors,
          conversionRate:
            currentVisitors > 0
              ? Number(((currentConversions / currentVisitors) * 100).toFixed(4))
              : 0,
        },
        previous: {
          conversions: previousConversions,
          uniqueVisitors: previousVisitors,
          conversionRate:
            previousVisitors > 0
              ? Number(((previousConversions / previousVisitors) * 100).toFixed(4))
              : 0,
        },
      });
    }

    // Sort by absolute change in conversion rate
    result.sort((a, b) => {
      const aChange = Math.abs(a.current.conversionRate - a.previous.conversionRate);
      const bChange = Math.abs(b.current.conversionRate - b.previous.conversionRate);
      return bChange - aChange;
    });

    // eslint-disable-next-line no-console
    console.log('✅ [clickhouseQuery] SUCCESS - returning result:', result);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ [clickhouseQuery] ERROR:', error);
    throw error;
  }
}
