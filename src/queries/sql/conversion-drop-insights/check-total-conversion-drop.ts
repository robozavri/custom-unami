import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface ConversionDropData {
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

export async function getConversionDropData(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
): Promise<ConversionDropData> {
  return runQuery({
    [PRISMA]: () =>
      relationalQuery(websiteId, conversionEvent, currentFrom, currentTo, previousFrom, previousTo),
    [CLICKHOUSE]: () =>
      clickhouseQuery(websiteId, conversionEvent, currentFrom, currentTo, previousFrom, previousTo),
  });
}

async function relationalQuery(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
): Promise<ConversionDropData> {
  // eslint-disable-next-line no-console
  console.log('🔍 [relationalQuery] START with params:', {
    websiteId,
    conversionEvent,
    currentFrom,
    currentTo,
    previousFrom,
    previousTo,
  });

  const { rawQuery } = prisma;

  try {
    // Get current period data
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Executing current period query...');
    const currentResult = await rawQuery(
      `
      SELECT
        COUNT(DISTINCT e.session_id) AS conversions,
        COUNT(DISTINCT s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      `,
      { websiteId, conversionEvent, currentFrom, currentTo },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Current period result:', currentResult);

    // Get previous period data
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Executing previous period query...');
    const previousResult = await rawQuery(
      `
      SELECT
        COUNT(DISTINCT e.session_id) AS conversions,
        COUNT(DISTINCT s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      `,
      { websiteId, conversionEvent, previousFrom, previousTo },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [relationalQuery] Previous period result:', previousResult);

    const current = currentResult[0] as any;
    const previous = previousResult[0] as any;

    // Convert BigInt to Number for calculations
    const currentConversions = Number(current.conversions);
    const currentVisitors = Number(current.unique_visitors);
    const previousConversions = Number(previous.conversions);
    const previousVisitors = Number(previous.unique_visitors);

    const result = {
      current: {
        conversions: currentConversions || 0,
        uniqueVisitors: currentVisitors || 0,
        conversionRate:
          currentVisitors > 0
            ? Number(((currentConversions / currentVisitors) * 100).toFixed(4))
            : 0,
      },
      previous: {
        conversions: previousConversions || 0,
        uniqueVisitors: previousVisitors || 0,
        conversionRate:
          previousVisitors > 0
            ? Number(((previousConversions / previousVisitors) * 100).toFixed(4))
            : 0,
      },
    };

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
): Promise<ConversionDropData> {
  // eslint-disable-next-line no-console
  console.log('🔍 [clickhouseQuery] START with params:', {
    websiteId,
    conversionEvent,
    currentFrom,
    currentTo,
    previousFrom,
    previousTo,
  });

  const { rawQuery } = clickhouse;

  try {
    // Get current period data
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Executing current period query...');
    const currentResult = await rawQuery(
      `
      SELECT
        uniq(e.session_id) AS conversions,
        uniq(s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {websiteId:UUID}
        AND e.event_name = {conversionEvent:String}
        AND e.created_at BETWEEN parseDateTime64BestEffort({currentFrom:String}) AND parseDateTime64BestEffort({currentTo:String})
      `,
      { websiteId, conversionEvent, currentFrom, currentTo },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Current period result:', currentResult);

    // Get previous period data
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Executing previous period query...');
    const previousResult = await rawQuery(
      `
      SELECT
        uniq(e.session_id) AS conversions,
        uniq(s.distinct_id) AS unique_visitors
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {websiteId:UUID}
        AND e.event_name = {conversionEvent:String}
        AND e.created_at BETWEEN parseDateTime64BestEffort({previousFrom:String}) AND parseDateTime64BestEffort({previousTo:String})
      `,
      { websiteId, conversionEvent, previousFrom, previousTo },
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [clickhouseQuery] Previous period result:', previousResult);

    const current = currentResult[0] as any;
    const previous = previousResult[0] as any;

    // Convert to Number for calculations (ClickHouse might return different types)
    const currentConversions = Number(current.conversions);
    const currentVisitors = Number(current.unique_visitors);
    const previousConversions = Number(previous.conversions);
    const previousVisitors = Number(previous.unique_visitors);

    const result = {
      current: {
        conversions: currentConversions || 0,
        uniqueVisitors: currentVisitors || 0,
        conversionRate:
          currentVisitors > 0
            ? Number(((currentConversions / currentVisitors) * 100).toFixed(4))
            : 0,
      },
      previous: {
        conversions: previousConversions || 0,
        uniqueVisitors: previousVisitors || 0,
        conversionRate:
          previousVisitors > 0
            ? Number(((previousConversions / previousVisitors) * 100).toFixed(4))
            : 0,
      },
    };

    // eslint-disable-next-line no-console
    console.log('✅ [clickhouseQuery] SUCCESS - returning result:', result);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ [clickhouseQuery] ERROR:', error);
    throw error;
  }
}
