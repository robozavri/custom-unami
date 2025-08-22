import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
/* eslint-disable no-console */

export interface DeviceConversionData {
  device: string;
  conversions: number;
  uniqueVisitors: number;
  period: 'current' | 'previous';
}

export async function getDeviceConversionData(
  websiteId: string,
  conversionEvent: string,
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number,
): Promise<any[]> {
  console.log('[compare-by-device] Getting device conversion data...');
  console.log('[compare-by-device] Website ID:', websiteId);
  console.log('[compare-by-device] Conversion event:', conversionEvent);
  console.log('[compare-by-device] Current period:', currentFrom, 'to', currentTo);
  console.log('[compare-by-device] Previous period:', previousFrom, 'to', previousTo);
  console.log('[compare-by-device] Min visitors:', minVisitors);

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
  console.log('[compare-by-device] Executing relational query...');

  const { rawQuery } = prisma;

  try {
    // Get current period data - use separate queries for visitors and conversions
    const currentVisitorsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.device, 'Unknown') AS device,
        COUNT(DISTINCT s.distinct_id) AS "uniqueVisitors"
      FROM session s
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY s.device
      `,
      { websiteId, currentFrom, currentTo },
    );

    const currentConversionsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.device, 'Unknown') AS device,
        COUNT(DISTINCT e.session_id) AS conversions
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY s.device
      `,
      { websiteId, conversionEvent, currentFrom, currentTo },
    );

    const previousVisitorsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.device, 'Unknown') AS device,
        COUNT(DISTINCT s.distinct_id) AS "uniqueVisitors"
      FROM session s
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY s.device
      `,
      { websiteId, previousFrom, previousTo },
    );

    const previousConversionsResult = await rawQuery(
      `
      SELECT
        COALESCE(s.device, 'Unknown') AS device,
        COUNT(DISTINCT e.session_id) AS conversions
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY s.device
      `,
      { websiteId, conversionEvent, previousFrom, previousTo },
    );

    console.log(
      '[compare-by-device] Current period visitors:',
      currentVisitorsResult?.length || 0,
      'devices',
    );
    console.log(
      '[compare-by-device] Current period conversions:',
      currentConversionsResult?.length || 0,
      'devices',
    );
    console.log(
      '[compare-by-device] Previous period visitors:',
      previousVisitorsResult?.length || 0,
      'devices',
    );
    console.log(
      '[compare-by-device] Previous period conversions:',
      previousConversionsResult?.length || 0,
      'devices',
    );

    // Process results and combine data
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    // Process current period results
    console.log('[compare-by-device] Current visitors result:', currentVisitorsResult);
    console.log('[compare-by-device] Current conversions result:', currentConversionsResult);

    if (Array.isArray(currentVisitorsResult)) {
      currentVisitorsResult.forEach((row: any) => {
        console.log('[compare-by-device] Processing visitor row:', row);
        currentMap.set(row.device, { ...row, conversions: 0 });
      });
    }

    if (Array.isArray(currentConversionsResult)) {
      currentConversionsResult.forEach((row: any) => {
        console.log('[compare-by-device] Processing conversion row:', row);
        if (currentMap.has(row.device)) {
          currentMap.get(row.device).conversions = row.conversions;
        }
      });
    }

    // Process previous period results
    if (Array.isArray(previousVisitorsResult)) {
      previousVisitorsResult.forEach((row: any) => {
        previousMap.set(row.device, { ...row, conversions: 0 });
      });
    }

    if (Array.isArray(previousConversionsResult)) {
      previousConversionsResult.forEach((row: any) => {
        if (previousMap.has(row.device)) {
          previousMap.get(row.device).conversions = row.conversions;
        }
      });
    }

    // Combine all unique devices
    const allDevices = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const result: any[] = [];

    for (const device of allDevices) {
      const current = currentMap.get(device);
      const previous = previousMap.get(device);

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
          device,
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

    console.log('[compare-by-device] Final result:', result.length, 'devices');
    return result;
  } catch (error) {
    console.error('[compare-by-device] Error getting device conversion data:', error);
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
  console.log('[compare-by-device] Executing ClickHouse query...');

  try {
    // Get current period data
    const currentResult = await clickhouse.client.query({
      query: `
        SELECT
          COALESCE(s.device, 'Unknown') AS device,
          uniq(e.session_id) AS conversions,
          uniq(s.distinct_id) AS unique_visitors
        FROM website_event e
        JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
        WHERE e.website_id = {websiteId:UUID}
          AND e.event_name = {conversionEvent:String}
          AND e.created_at BETWEEN parseDateTime64BestEffort({currentFrom:String}) AND parseDateTime64BestEffort({currentTo:String})
        GROUP BY s.device
        HAVING uniq(s.distinct_id) >= {minVisitors:UInt32}
        ORDER BY unique_visitors DESC
      `,
      query_params: { websiteId, conversionEvent, currentFrom, currentTo, minVisitors },
    });

    // Get previous period data
    const previousResult = await clickhouse.client.query({
      query: `
        SELECT
          COALESCE(s.device, 'Unknown') AS device,
          uniq(e.session_id) AS conversions,
          uniq(s.distinct_id) AS unique_visitors
        FROM website_event e
        JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
        WHERE e.website_id = {websiteId:UUID}
          AND e.event_name = {conversionEvent:String}
          AND e.created_at BETWEEN parseDateTime64BestEffort({previousFrom:String}) AND parseDateTime64BestEffort({previousTo:String})
        GROUP BY s.device
        HAVING uniq(s.distinct_id) >= {minVisitors:UInt32}
        ORDER BY unique_visitors DESC
      `,
      query_params: { websiteId, conversionEvent, previousFrom, previousTo, minVisitors },
    });

    const currentData = (await currentResult.json()) as unknown as any[];
    const previousData = (await previousResult.json()) as unknown as any[];

    console.log('[compare-by-device] Current period results:', currentData?.length || 0, 'devices');
    console.log(
      '[compare-by-device] Previous period results:',
      previousData?.length || 0,
      'devices',
    );

    // Process results and combine data
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    // Process current period results
    if (Array.isArray(currentData)) {
      currentData.forEach((row: any) => {
        currentMap.set(row.device, row);
      });
    }

    // Process previous period results
    if (Array.isArray(previousData)) {
      previousData.forEach((row: any) => {
        previousMap.set(row.device, row);
      });
    }

    // Combine all unique devices
    const allDevices = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const result: any[] = [];

    for (const device of allDevices) {
      const current = currentMap.get(device);
      const previous = previousMap.get(device);

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
          device,
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

    console.log('[compare-by-device] Final result:', result.length, 'devices');
    return result;
  } catch (error) {
    console.error('[compare-by-device] Error getting device conversion data:', error);
    throw error;
  }
}
