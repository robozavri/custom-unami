import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface MostFrequentEvent {
  eventName: string;
  eventCount: number;
  percentage: number;
}

export interface MostFrequentEventsResult {
  events: MostFrequentEvent[];
  totalEvents: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export async function getMostFrequentEvents(
  ...args: [websiteId: string, startDate: Date, endDate: Date, limit?: number]
): Promise<MostFrequentEventsResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 10,
): Promise<MostFrequentEventsResult> {
  const { rawQuery } = prisma;

  // Get total event count for percentage calculation
  const totalCountResult = await rawQuery(
    `
    SELECT COUNT(*) as total_count
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent },
  );

  const totalEvents = Number(totalCountResult[0]?.total_count || 0);

  // Get most frequent events
  const eventsResult = await rawQuery(
    `
    SELECT 
      event_name,
      COUNT(*) as event_count
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
    GROUP BY event_name
    ORDER BY event_count DESC
    LIMIT {{limit}}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, limit },
  );

  const events: MostFrequentEvent[] = eventsResult.map((row: any) => ({
    eventName: row.event_name,
    eventCount: Number(row.event_count),
    percentage: totalEvents > 0 ? (Number(row.event_count) / totalEvents) * 100 : 0,
  }));

  return {
    events,
    totalEvents,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 10,
): Promise<MostFrequentEventsResult> {
  const { rawQuery } = clickhouse;

  // Get total event count for percentage calculation
  const totalCountResult = await rawQuery(
    `
    SELECT COUNT(*) as total_count
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
    },
  );

  const totalEvents = Number(totalCountResult[0]?.total_count || 0);

  // Get most frequent events
  const eventsResult = await rawQuery(
    `
    SELECT 
      event_name,
      COUNT(*) as event_count
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
    GROUP BY event_name
    ORDER BY event_count DESC
    LIMIT {limit:UInt32}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      limit,
    },
  );

  const events: MostFrequentEvent[] = Array.isArray(eventsResult)
    ? eventsResult.map((row: any) => ({
        eventName: row.event_name,
        eventCount: Number(row.event_count),
        percentage: totalEvents > 0 ? (Number(row.event_count) / totalEvents) * 100 : 0,
      }))
    : [];

  return {
    events,
    totalEvents,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
  };
}
