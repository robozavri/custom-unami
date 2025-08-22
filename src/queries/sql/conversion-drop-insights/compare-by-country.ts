import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
/* eslint-disable no-console */
export interface CountryConversionData {
  country: string;
  conversions: number;
  uniqueVisitors: number;
  period: 'current' | 'previous';
}

export async function getCountryConversionData(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number,
): Promise<any[]> {
  console.log('[compare-by-country] Getting country conversion data...');
  console.log('[compare-by-country] Website ID:', websiteId);
  console.log('[compare-by-country] Conversion event:', conversionEvent);
  console.log('[compare-by-country] Current period:', currentFrom, 'to', currentTo);
  console.log('[compare-by-country] Previous period:', previousFrom, 'to', previousTo);
  console.log('[compare-by-country] Min visitors:', minVisitors);

  return runQuery({
    [PRISMA]: () =>
      relationalQuery(websiteId, conversionEvent, currentFrom, currentTo, previousFrom, previousTo),
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
): Promise<any[]> {
  console.log('[compare-by-country] Executing relational query...');

  const { rawQuery } = prisma;

  try {
    // Get current period data - use separate queries for visitors and conversions
    const currentVisitorsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.country, 'Unknown') AS country,
        COUNT(DISTINCT s.distinct_id) AS "uniqueVisitors"
      FROM session s
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY s.country
      `,
      { websiteId, currentFrom, currentTo },
    );

    const currentConversionsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.country, 'Unknown') AS country,
        COUNT(DISTINCT e.session_id) AS conversions
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY s.country
      `,
      { websiteId, conversionEvent, currentFrom, currentTo },
    );

    const previousVisitorsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.country, 'Unknown') AS country,
        COUNT(DISTINCT s.distinct_id) AS "uniqueVisitors"
      FROM session s
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY s.country
      `,
      { websiteId, previousFrom, previousTo },
    );

    const previousConversionsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.country, 'Unknown') AS country,
        COUNT(DISTINCT e.session_id) AS conversions
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY s.country
      `,
      { websiteId, conversionEvent, previousFrom, previousTo },
    );

    console.log(
      '[compare-by-country] Current period visitors:',
      currentVisitorsResult?.length || 0,
      'countries',
    );
    console.log(
      '[compare-by-country] Current period conversions:',
      currentConversionsResult?.length || 0,
      'countries',
    );
    console.log(
      '[compare-by-country] Previous period visitors:',
      previousVisitorsResult?.length || 0,
      'countries',
    );
    console.log(
      '[compare-by-country] Previous period conversions:',
      previousConversionsResult?.length || 0,
      'countries',
    );

    // Process results and combine data
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    // Process current period results
    console.log('[compare-by-country] Current visitors result:', currentVisitorsResult);
    console.log('[compare-by-country] Current conversions result:', currentConversionsResult);

    if (Array.isArray(currentVisitorsResult)) {
      currentVisitorsResult.forEach((row: any) => {
        console.log('[compare-by-country] Processing visitor row:', row);
        currentMap.set(row.country, { ...row, conversions: 0 });
      });
    }

    if (Array.isArray(currentConversionsResult)) {
      currentConversionsResult.forEach((row: any) => {
        console.log('[compare-by-country] Processing conversion row:', row);
        if (currentMap.has(row.country)) {
          currentMap.get(row.country).conversions = row.conversions;
        }
      });
    }

    // Process previous period results
    if (Array.isArray(previousVisitorsResult)) {
      previousVisitorsResult.forEach((row: any) => {
        previousMap.set(row.country, { ...row, conversions: 0 });
      });
    }

    if (Array.isArray(previousConversionsResult)) {
      previousConversionsResult.forEach((row: any) => {
        if (previousMap.has(row.country)) {
          previousMap.get(row.country).conversions = row.conversions;
        }
      });
    }

    // Combine all unique countries
    const allCountries = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const result: any[] = [];

    for (const country of allCountries) {
      const current = currentMap.get(country);
      const previous = previousMap.get(country);

      if (current && previous) {
        // Convert BigInt to Number for calculations
        const currentConversions = Number(current.conversions);
        const currentVisitors = Number(current.uniqueVisitors);
        const previousConversions = Number(previous.conversions);
        const previousVisitors = Number(previous.uniqueVisitors);

        const currentRate = currentVisitors > 0 ? currentConversions / currentVisitors : 0;
        const previousRate = previousVisitors > 0 ? previousConversions / previousVisitors : 0;
        const rateDelta = currentRate - previousRate;
        const percentChange = previousRate > 0 ? (rateDelta / previousRate) * 100 : 0;

        let direction: 'increase' | 'decrease' | 'no_change' = 'no_change';
        if (percentChange > 0.5) {
          direction = 'increase';
        } else if (percentChange < -0.5) {
          direction = 'decrease';
        }

        result.push({
          country,
          current: {
            conversions: currentConversions,
            uniqueVisitors: currentVisitors,
            conversionRate: currentRate,
          },
          previous: {
            conversions: previousConversions,
            uniqueVisitors: previousVisitors,
            conversionRate: previousRate,
          },
          change: {
            rateDelta,
            percentChange,
            direction,
          },
        });
      }
    }

    // Sort by absolute change in conversion rate for prioritization
    result.sort((a, b) => Math.abs(b.change.rateDelta) - Math.abs(a.change.rateDelta));

    console.log('[compare-by-country] Final result:', result.length, 'countries');
    return result;
  } catch (error) {
    console.error('[compare-by-country] Error getting country conversion data:', error);
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
): Promise<any[]> {
  console.log('[compare-by-country] Executing ClickHouse query...');

  try {
    // Get current period data
    const currentResult = await clickhouse.client.query({
      query: `
        SELECT
          COALESCE(s.country, 'Unknown') AS country,
          uniq(e.session_id) AS conversions,
          uniq(s.distinct_id) AS unique_visitors
        FROM website_event e
        JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
        WHERE e.website_id = {websiteId:UUID}
          AND e.event_name = {conversionEvent:String}
          AND e.created_at BETWEEN parseDateTime64BestEffort({currentFrom:String}) AND parseDateTime64BestEffort({currentTo:String})
        GROUP BY s.country
        HAVING uniq(s.distinct_id) >= {minVisitors:UInt32}
        ORDER BY unique_visitors DESC
      `,
      query_params: { websiteId, conversionEvent, currentFrom, currentTo, minVisitors },
    });

    // Get previous period data
    const previousResult = await clickhouse.client.query({
      query: `
        SELECT
          COALESCE(s.country, 'Unknown') AS country,
          uniq(e.session_id) AS conversions,
          uniq(s.distinct_id) AS unique_visitors
        FROM website_event e
        JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
        WHERE e.website_id = {websiteId:UUID}
          AND e.event_name = {conversionEvent:String}
          AND e.created_at BETWEEN parseDateTime64BestEffort({previousFrom:String}) AND parseDateTime64BestEffort({previousTo:String})
        GROUP BY s.country
        HAVING uniq(s.distinct_id) >= {minVisitors:UInt32}
        ORDER BY unique_visitors DESC
      `,
      query_params: { websiteId, conversionEvent, previousFrom, previousTo, minVisitors },
    });

    const currentData = (await currentResult.json()) as unknown as any[];
    const previousData = (await previousResult.json()) as unknown as any[];

    console.log(
      '[compare-by-country] Current period results:',
      currentData?.length || 0,
      'countries',
    );
    console.log(
      '[compare-by-country] Previous period results:',
      previousData?.length || 0,
      'countries',
    );

    // Process results and combine data
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    // Process current period results
    if (Array.isArray(currentData)) {
      currentData.forEach((row: any) => {
        currentMap.set(row.country, row);
      });
    }

    // Process previous period results
    if (Array.isArray(previousData)) {
      previousData.forEach((row: any) => {
        previousMap.set(row.country, row);
      });
    }

    // Combine all unique countries
    const allCountries = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const result: any[] = [];

    for (const country of allCountries) {
      const current = currentMap.get(country);
      const previous = previousMap.get(country);

      if (current && previous) {
        const currentRate = current.conversions / current.uniqueVisitors;
        const previousRate = previous.conversions / previous.uniqueVisitors;
        const rateDelta = currentRate - previousRate;
        const percentChange = previousRate > 0 ? (rateDelta / previousRate) * 100 : 0;

        let direction: 'increase' | 'decrease' | 'no_change' = 'no_change';
        if (percentChange > 0.5) {
          direction = 'increase';
        } else if (percentChange < -0.5) {
          direction = 'decrease';
        }

        result.push({
          country,
          current: {
            conversions: current.conversions,
            uniqueVisitors: current.uniqueVisitors,
            conversionRate: currentRate,
          },
          previous: {
            conversions: previous.conversions,
            uniqueVisitors: previous.uniqueVisitors,
            conversionRate: previousRate,
          },
          change: {
            rateDelta,
            percentChange,
            direction,
          },
        });
      }
    }

    // Sort by absolute change in conversion rate for prioritization
    result.sort((a, b) => Math.abs(b.change.rateDelta) - Math.abs(a.change.rateDelta));

    console.log('[compare-by-country] Final result:', result.length, 'countries');
    return result;
  } catch (error) {
    console.error('[compare-by-country] Error getting country conversion data:', error);
    throw error;
  }
}
