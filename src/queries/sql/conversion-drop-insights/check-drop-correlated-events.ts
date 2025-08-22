import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
/* eslint-disable no-console */

export interface CorrelatedEventData {
  event: string;
  dropSessionCount: number;
  dropSessionPercent: number;
  converterSessionPercent?: number;
  delta?: number;
  direction?: 'higher_in_drops' | 'higher_in_converters' | 'neutral';
}

export async function getDropCorrelatedEventsData(
  websiteId: string,
  targetEvent: string,
  fromDate: string,
  toDate: string,
  compareWithConverters: boolean = false,
): Promise<CorrelatedEventData[]> {
  console.log('[check-drop-correlated-events] Getting drop correlated events data...');
  console.log('[check-drop-correlated-events] Website ID:', websiteId);
  console.log('[check-drop-correlated-events] Target event:', targetEvent);
  console.log('[check-drop-correlated-events] Date range:', fromDate, 'to', toDate);
  console.log('[check-drop-correlated-events] Compare with converters:', compareWithConverters);

  return runQuery({
    [PRISMA]: () =>
      relationalQuery(websiteId, targetEvent, fromDate, toDate, compareWithConverters),
    [CLICKHOUSE]: () => clickhouseQuery(),
  });
}

async function relationalQuery(
  websiteId: string,
  targetEvent: string,
  fromDate: string,
  toDate: string,
  compareWithConverters: boolean,
): Promise<CorrelatedEventData[]> {
  console.log('[check-drop-correlated-events] Executing relational query...');

  try {
    // Step 1: Find sessions that DID NOT convert
    const nonConvertingSessions = await prisma.rawQuery(
      `
      SELECT s.session_id AS session_id
      FROM session s
      LEFT JOIN website_event e ON e.session_id = s.session_id
        AND e.event_name = {{targetEvent}}
        AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
      WHERE s.website_id = {{websiteId::uuid}}
        AND s.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
        AND e.event_name IS NULL
      `,
      { websiteId, targetEvent, fromDate, toDate },
    );

    if (!nonConvertingSessions || nonConvertingSessions.length === 0) {
      console.log('[check-drop-correlated-events] No non-converting sessions found');
      return [];
    }

    const nonConvertingSessionIds = nonConvertingSessions.map((s: any) => s.session_id);
    console.log(
      '[check-drop-correlated-events] Found',
      nonConvertingSessionIds.length,
      'non-converting sessions',
    );

    // Step 2: Get all events from non-converting sessions (excluding the target event)
    // Use a simpler approach that's guaranteed to work with Prisma
    let dropEvents: any[] = [];

    if (nonConvertingSessionIds.length > 0) {
      // Get all events for the website in the date range
      const allEvents = await prisma.rawQuery(
        `
        SELECT e.event_name, e.session_id
        FROM website_event e
        WHERE e.website_id = {{websiteId::uuid}}
          AND e.event_name != {{targetEvent}}
          AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
        `,
        { websiteId, targetEvent, fromDate, toDate },
      );

      // Filter by session IDs in JavaScript instead of SQL
      dropEvents = allEvents.filter((row: any) => nonConvertingSessionIds.includes(row.session_id));
    }

    // Step 3: Aggregate event frequencies
    const eventStats = new Map<string, { count: number; sessions: Set<string> }>();

    dropEvents.forEach((row: any) => {
      const eventName = row.event_name;
      const sessionId = row.session_id;

      if (!eventStats.has(eventName)) {
        eventStats.set(eventName, { count: 0, sessions: new Set() });
      }

      const stats = eventStats.get(eventName)!;
      stats.count += 1;
      stats.sessions.add(sessionId);
    });

    // Step 4: Calculate percentages and prepare results
    const results: CorrelatedEventData[] = [];

    if (compareWithConverters) {
      // Get converting sessions for comparison
      const convertingSessions = await prisma.rawQuery(
        `
        SELECT s.session_id AS session_id
        FROM session s
        JOIN website_event e ON e.session_id = s.session_id
          AND e.event_name = {{targetEvent}}
          AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
        WHERE s.website_id = {{websiteId::uuid}}
          AND s.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
        `,
        { websiteId, targetEvent, fromDate, toDate },
      );

      const convertingSessionIds = convertingSessions.map((s: any) => s.session_id);
      console.log(
        '[check-drop-correlated-events] Found',
        convertingSessionIds.length,
        'converting sessions',
      );

      // Get events from converting sessions
      let converterEvents: any[] = [];

      if (convertingSessionIds.length > 0) {
        // Get all events for the website in the date range
        const allConverterEvents = await prisma.rawQuery(
          `
          SELECT e.event_name, e.session_id
          FROM website_event e
          WHERE e.website_id = {{websiteId::uuid}}
            AND e.event_name != {{targetEvent}}
            AND e.created_at BETWEEN {{fromDate::timestamp}} AND {{toDate::timestamp}}
          `,
          { websiteId, targetEvent, fromDate, toDate },
        );

        // Filter by session IDs in JavaScript instead of SQL
        converterEvents = allConverterEvents.filter((row: any) =>
          convertingSessionIds.includes(row.session_id),
        );
      }

      // Calculate converter event frequencies
      const converterEventStats = new Map<string, Set<string>>();
      converterEvents.forEach((row: any) => {
        const eventName = row.event_name;
        const sessionId = row.session_id;

        if (!converterEventStats.has(eventName)) {
          converterEventStats.set(eventName, new Set());
        }
        converterEventStats.get(eventName)!.add(sessionId);
      });

      // Build results with comparison
      eventStats.forEach((stats, eventName) => {
        const dropSessionCount = stats.sessions.size;
        const dropSessionPercent = (dropSessionCount / nonConvertingSessionIds.length) * 100;

        const converterSessionCount = converterEventStats.get(eventName)?.size || 0;
        const converterSessionPercent = (converterSessionCount / convertingSessionIds.length) * 100;

        const delta = dropSessionPercent - converterSessionPercent;
        const direction =
          delta > 1 ? 'higher_in_drops' : delta < -1 ? 'higher_in_converters' : 'neutral';

        results.push({
          event: eventName,
          dropSessionCount,
          dropSessionPercent,
          converterSessionPercent,
          delta,
          direction,
        });
      });
    } else {
      // Simple results without comparison
      eventStats.forEach((stats, eventName) => {
        const dropSessionCount = stats.sessions.size;
        const dropSessionPercent = (dropSessionCount / nonConvertingSessionIds.length) * 100;

        results.push({
          event: eventName,
          dropSessionCount,
          dropSessionPercent,
        });
      });
    }

    // Sort by drop session percent descending
    results.sort((a, b) => b.dropSessionPercent - a.dropSessionPercent);

    console.log('[check-drop-correlated-events] Final result:', results.length, 'events');
    return results;
  } catch (error) {
    console.error(
      '[check-drop-correlated-events] Error getting drop correlated events data:',
      error,
    );
    throw error;
  }
}

async function clickhouseQuery(): Promise<CorrelatedEventData[]> {
  console.log('[check-drop-correlated-events] Executing ClickHouse query...');

  try {
    // Return mock data for ClickHouse as well
    const mockResults: CorrelatedEventData[] = [
      {
        event: 'clicked_help',
        dropSessionCount: 150,
        dropSessionPercent: 25.5,
        converterSessionPercent: 15.2,
        delta: 10.3,
        direction: 'higher_in_drops',
      },
      {
        event: 'opened_settings',
        dropSessionCount: 120,
        dropSessionPercent: 20.4,
        converterSessionPercent: 18.7,
        delta: 1.7,
        direction: 'higher_in_drops',
      },
      {
        event: 'viewed_pricing',
        dropSessionCount: 100,
        dropSessionPercent: 17.0,
        converterSessionPercent: 22.1,
        delta: -5.1,
        direction: 'higher_in_converters',
      },
    ];

    console.log('[check-drop-correlated-events] Returning mock results for ClickHouse testing');
    return mockResults;
  } catch (error) {
    console.error(
      '[check-drop-correlated-events] Error getting drop correlated events data:',
      error,
    );
    throw error;
  }
}
