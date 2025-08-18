import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventOverviewResult {
  totalEventCount: number;
  uniqueUsers: number;
  eventFrequencyPerUser: number;
  totalUniqueEvents: number;
  topEvents: Array<{
    event_name: string;
    event_count: number;
    unique_users: number;
  }>;
  events: Array<{
    event_name: string;
    event_count: number;
    unique_users: number;
  }>;
}

export async function getEventOverview(
  ...args: [websiteId: string, startDate: Date, endDate: Date, eventName?: string]
): Promise<EventOverviewResult> {
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
): Promise<EventOverviewResult> {
  const { rawQuery } = prisma;

  // Build event filter
  const eventFilter = eventName ? 'and event_name = {{eventName}}' : '';

  // Get total event count
  const totalCountResult = await rawQuery(
    `
    SELECT COUNT(*) as total_count
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      ${eventFilter}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  // Get unique users count
  const uniqueUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      ${eventFilter}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  // Get top events
  const topEventsResult = await rawQuery(
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
    LIMIT 10
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

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

  const totalEventCount = Number(totalCountResult[0]?.total_count || 0);
  const uniqueUsers = Number(uniqueUsersResult[0]?.unique_users || 0);
  const eventFrequencyPerUser = uniqueUsers > 0 ? totalEventCount / uniqueUsers : 0;
  const totalUniqueEvents = eventsResult.length;

  return {
    totalEventCount,
    uniqueUsers,
    eventFrequencyPerUser,
    totalUniqueEvents,
    topEvents: topEventsResult.map((row: any) => ({
      event_name: row.event_name || 'Unknown',
      event_count: Number(row.event_count || 0),
      unique_users: Number(row.unique_users || 0),
    })),
    events: eventsResult.map((row: any) => ({
      event_name: row.event_name || 'Unknown',
      event_count: Number(row.event_count || 0),
      unique_users: Number(row.unique_users || 0),
    })),
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<EventOverviewResult> {
  const { rawQuery } = clickhouse;

  // Build event filter
  const eventFilter = eventName ? 'AND event_name = {eventName:String}' : '';

  // Get total event count
  const totalCountResult = await rawQuery(
    `
    SELECT COUNT(*) as total_count
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
      ${eventFilter}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      ...(eventName && { eventName }),
    },
  );

  // Get unique users count
  const uniqueUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
      ${eventFilter}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      ...(eventName && { eventName }),
    },
  );

  // Get top events
  const topEventsResult = await rawQuery(
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
    LIMIT 10
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      ...(eventName && { eventName }),
    },
  );

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

  const totalEventCount = Number(totalCountResult[0]?.total_count || 0);
  const uniqueUsers = Number(uniqueUsersResult[0]?.unique_users || 0);
  const eventFrequencyPerUser = uniqueUsers > 0 ? totalEventCount / uniqueUsers : 0;
  const totalUniqueEvents = Array.isArray(eventsResult) ? eventsResult.length : 0;

  return {
    totalEventCount,
    uniqueUsers,
    eventFrequencyPerUser,
    totalUniqueEvents,
    topEvents: Array.isArray(topEventsResult)
      ? topEventsResult.map((row: any) => ({
          event_name: row.event_name || 'Unknown',
          event_count: Number(row.event_count || 0),
          unique_users: Number(row.unique_users ?? 0),
        }))
      : [],
    events: Array.isArray(eventsResult)
      ? eventsResult.map((row: any) => ({
          event_name: row.event_name || 'Unknown',
          event_count: Number(row.event_count ?? 0),
          unique_users: Number(row.unique_users ?? 0),
        }))
      : [],
  };
}
