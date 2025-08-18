import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface TotalUniqueEventsResult {
  totalUniqueEvents: number;
  events: Array<{
    event_name: string;
    event_count: number;
    unique_users: number;
  }>;
}

export async function getTotalUniqueEvents(
  ...args: [websiteId: string, startDate: Date, endDate: Date, eventName?: string]
): Promise<TotalUniqueEventsResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<TotalUniqueEventsResult> {
  const { rawQuery } = prisma;

  // Build event filter
  const eventFilter = eventName ? 'and event_name = {{eventName}}' : '';

  // Get all events for detailed breakdown
  const eventsResult = await rawQuery(
    `
    SELECT 
      event_name,
      COUNT(*) as event_count,
      COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      ${eventFilter}
    GROUP BY event_name
    ORDER BY event_count DESC
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  const totalUniqueEvents = eventsResult.length;
  const events = eventsResult.map((row: any) => ({
    event_name: row.event_name || 'Unknown',
    event_count: Number(row.event_count || 0),
    unique_users: Number(row.unique_users || 0),
  }));

  return {
    totalUniqueEvents,
    events,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<TotalUniqueEventsResult> {
  const { rawQuery } = clickhouse;

  // Build event filter
  const eventFilter = eventName ? 'AND event_name = {eventName:String}' : '';

  // Get all events for detailed breakdown
  const eventsResult = await rawQuery(
    `
    SELECT 
      event_name,
      COUNT(*) as event_count,
      COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
      ${eventFilter}
    GROUP BY event_name
    ORDER BY event_count DESC
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      ...(eventName && { eventName }),
    },
  );

  const totalUniqueEvents = Array.isArray(eventsResult) ? eventsResult.length : 0;
  const events = Array.isArray(eventsResult)
    ? eventsResult.map((row: any) => ({
        event_name: row.event_name || 'Unknown',
        event_count: Number(row.event_count ?? 0),
        unique_users: Number(row.unique_users ?? 0),
      }))
    : [];

  return {
    totalUniqueEvents,
    events,
  };
}
