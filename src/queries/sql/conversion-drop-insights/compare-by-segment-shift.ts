import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
/* eslint-disable no-console */

export interface SegmentShiftData {
  segment: Record<string, string>;
  conversions: number;
  uniqueVisitors: number;
  period: 'current' | 'previous';
}

export async function getSegmentShiftData(
  websiteId: string,
  conversionEvent: string,
  segmentFields: string[],
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number,
): Promise<any[]> {
  console.log('[compare-by-segment-shift] Getting segment shift data...');
  console.log('[compare-by-segment-shift] Website ID:', websiteId);
  console.log('[compare-by-segment-shift] Conversion event:', conversionEvent);
  console.log('[compare-by-segment-shift] Segment fields:', segmentFields);
  console.log('[compare-by-segment-shift] Current period:', currentFrom, 'to', currentTo);
  console.log('[compare-by-segment-shift] Previous period:', previousFrom, 'to', previousTo);
  console.log('[compare-by-segment-shift] Min visitors:', minVisitors);

  return runQuery({
    [PRISMA]: () =>
      relationalQuery(
        websiteId,
        conversionEvent,
        segmentFields,
        currentFrom,
        currentTo,
        previousFrom,
        previousTo,
      ),
    [CLICKHOUSE]: () =>
      clickhouseQuery(
        websiteId,
        conversionEvent,
        segmentFields,
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
  segmentFields: string[],
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
): Promise<any[]> {
  console.log('[compare-by-segment-shift] Executing relational query...');

  const { rawQuery } = prisma;

  try {
    // Build dynamic SELECT and GROUP BY clauses
    const selectFields = segmentFields.map(field => `s.${field}`).join(', ');
    const groupByFields = segmentFields.map(field => `s.${field}`).join(', ');

    // Get current period data - use separate queries for visitors and conversions
    const currentVisitorsResult = await rawQuery(
      `
      SELECT
        ${selectFields},
        COUNT(DISTINCT s.distinct_id) AS "uniqueVisitors"
      FROM session s
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY ${groupByFields}
      `,
      { websiteId, currentFrom, currentTo },
    );

    const currentConversionsResult = await rawQuery(
      `
      SELECT
        ${selectFields},
        COUNT(DISTINCT e.session_id) AS conversions
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{currentFrom::timestamp}} AND {{currentTo::timestamp}}
      GROUP BY ${groupByFields}
      `,
      { websiteId, conversionEvent, currentFrom, currentTo },
    );

    const previousVisitorsResult = await rawQuery(
      `
      SELECT
        ${selectFields},
        COUNT(DISTINCT s.distinct_id) AS "uniqueVisitors"
      FROM session s
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY ${groupByFields}
      `,
      { websiteId, previousFrom, previousTo },
    );

    const previousConversionsResult = await rawQuery(
      `
      SELECT
        ${selectFields},
        COUNT(DISTINCT e.session_id) AS conversions
      FROM website_event e
      JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
      WHERE e.website_id = {{websiteId::uuid}}
        AND e.event_name = {{conversionEvent}}
        AND e.created_at BETWEEN {{previousFrom::timestamp}} AND {{previousTo::timestamp}}
      GROUP BY ${groupByFields}
      `,
      { websiteId, conversionEvent, previousFrom, previousTo },
    );

    console.log(
      '[compare-by-segment-shift] Current period visitors:',
      currentVisitorsResult?.length || 0,
      'segments',
    );
    console.log(
      '[compare-by-segment-shift] Current period conversions:',
      currentConversionsResult?.length || 0,
      'segments',
    );
    console.log(
      '[compare-by-segment-shift] Previous period visitors:',
      previousVisitorsResult?.length || 0,
      'segments',
    );
    console.log(
      '[compare-by-segment-shift] Previous period conversions:',
      previousConversionsResult?.length || 0,
      'segments',
    );

    // Process results and combine data
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    // Process current period results
    console.log('[compare-by-segment-shift] Current visitors result:', currentVisitorsResult);
    console.log('[compare-by-segment-shift] Current conversions result:', currentConversionsResult);

    if (Array.isArray(currentVisitorsResult)) {
      currentVisitorsResult.forEach((row: any) => {
        console.log('[compare-by-segment-shift] Processing visitor row:', row);
        const segmentKey = createSegmentKey(row, segmentFields);
        currentMap.set(segmentKey, { ...row, conversions: 0 });
      });
    }

    if (Array.isArray(currentConversionsResult)) {
      currentConversionsResult.forEach((row: any) => {
        console.log('[compare-by-segment-shift] Processing conversion row:', row);
        const segmentKey = createSegmentKey(row, segmentFields);
        if (currentMap.has(segmentKey)) {
          currentMap.get(segmentKey).conversions = row.conversions;
        }
      });
    }

    // Process previous period results
    if (Array.isArray(previousVisitorsResult)) {
      previousVisitorsResult.forEach((row: any) => {
        const segmentKey = createSegmentKey(row, segmentFields);
        previousMap.set(segmentKey, { ...row, conversions: 0 });
      });
    }

    if (Array.isArray(previousConversionsResult)) {
      previousConversionsResult.forEach((row: any) => {
        const segmentKey = createSegmentKey(row, segmentFields);
        if (previousMap.has(segmentKey)) {
          previousMap.get(segmentKey).conversions = row.conversions;
        }
      });
    }

    // Combine all unique segments
    const allSegments = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const result: any[] = [];

    for (const segmentKey of allSegments) {
      const current = currentMap.get(segmentKey);
      const previous = previousMap.get(segmentKey);

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

        // Create segment object
        const segment: Record<string, string> = {};
        segmentFields.forEach(field => {
          segment[field] = current[field] || 'Unknown';
        });

        result.push({
          segment,
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

    console.log('[compare-by-segment-shift] Final result:', result.length, 'segments');
    return result;
  } catch (error) {
    console.error('[compare-by-segment-shift] Error getting segment shift data:', error);
    throw error;
  }
}

async function clickhouseQuery(
  websiteId: string,
  conversionEvent: string,
  segmentFields: string[],
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
  minVisitors: number,
): Promise<any[]> {
  console.log('[compare-by-segment-shift] Executing ClickHouse query...');

  try {
    // Build dynamic SELECT and GROUP BY clauses
    const selectFields = segmentFields.map(field => `s.${field}`).join(', ');
    const groupByFields = segmentFields.map(field => `s.${field}`).join(', ');

    // Get current period data
    const currentResult = await clickhouse.client.query({
      query: `
        SELECT
          ${selectFields},
          uniq(e.session_id) AS conversions,
          uniq(s.distinct_id) AS unique_visitors
        FROM website_event e
        JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
        WHERE e.website_id = {websiteId:UUID}
          AND e.event_name = {conversionEvent:String}
          AND e.created_at BETWEEN parseDateTime64BestEffort({currentFrom:String}) AND parseDateTime64BestEffort({currentTo:String})
        GROUP BY ${groupByFields}
        HAVING uniq(s.distinct_id) >= {minVisitors:UInt32}
        ORDER BY unique_visitors DESC
      `,
      query_params: { websiteId, conversionEvent, currentFrom, currentTo, minVisitors },
    });

    // Get previous period data
    const previousResult = await clickhouse.client.query({
      query: `
        SELECT
          ${selectFields},
          uniq(e.session_id) AS conversions,
          uniq(s.distinct_id) AS unique_visitors
        FROM website_event e
        JOIN session s ON s.session_id = e.session_id AND s.website_id = e.website_id
        WHERE e.website_id = {websiteId:UUID}
          AND e.event_name = {conversionEvent:String}
          AND e.created_at BETWEEN parseDateTime64BestEffort({previousFrom:String}) AND parseDateTime64BestEffort({previousTo:String})
        GROUP BY ${groupByFields}
        HAVING uniq(s.distinct_id) >= {minVisitors:UInt32}
        ORDER BY unique_visitors DESC
      `,
      query_params: { websiteId, conversionEvent, previousFrom, previousTo, minVisitors },
    });

    const currentData = (await currentResult.json()) as unknown as any[];
    const previousData = (await previousResult.json()) as unknown as any[];

    console.log(
      '[compare-by-segment-shift] Current period results:',
      currentData?.length || 0,
      'segments',
    );
    console.log(
      '[compare-by-segment-shift] Previous period results:',
      previousData?.length || 0,
      'segments',
    );

    // Process results and combine data
    const currentMap = new Map<string, any>();
    const previousMap = new Map<string, any>();

    // Process current period results
    if (Array.isArray(currentData)) {
      currentData.forEach((row: any) => {
        const segmentKey = createSegmentKey(row, segmentFields);
        currentMap.set(segmentKey, row);
      });
    }

    // Process previous period results
    if (Array.isArray(previousData)) {
      previousData.forEach((row: any) => {
        const segmentKey = createSegmentKey(row, segmentFields);
        previousMap.set(segmentKey, row);
      });
    }

    // Combine all unique segments
    const allSegments = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const result: any[] = [];

    for (const segmentKey of allSegments) {
      const current = currentMap.get(segmentKey);
      const previous = previousMap.get(segmentKey);

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

        // Create segment object
        const segment: Record<string, string> = {};
        segmentFields.forEach(field => {
          segment[field] = current[field] || 'Unknown';
        });

        result.push({
          segment,
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

    console.log('[compare-by-segment-shift] Final result:', result.length, 'segments');
    return result;
  } catch (error) {
    console.error('[compare-by-segment-shift] Error getting segment shift data:', error);
    throw error;
  }
}

// Helper function to create a unique key for segments
function createSegmentKey(row: any, segmentFields: string[]): string {
  return segmentFields.map(field => `${field}:${row[field] || 'Unknown'}`).join('|');
}
