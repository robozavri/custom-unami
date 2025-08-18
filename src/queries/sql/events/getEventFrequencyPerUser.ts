import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventFrequencyPerUserResult {
  eventFrequencyPerUser: number;
  totalEventCount: number;
  uniqueUsers: number;
}

export async function getEventFrequencyPerUser(
  ...args: [websiteId: string, startDate: Date, endDate: Date, eventName?: string]
): Promise<EventFrequencyPerUserResult> {
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
): Promise<EventFrequencyPerUserResult> {
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

  const totalEventCount = Number(totalCountResult[0]?.total_count || 0);
  const uniqueUsers = Number(uniqueUsersResult[0]?.unique_users || 0);
  const eventFrequencyPerUser = uniqueUsers > 0 ? totalEventCount / uniqueUsers : 0;

  return {
    eventFrequencyPerUser,
    totalEventCount,
    uniqueUsers,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<EventFrequencyPerUserResult> {
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

  const totalEventCount = Number(totalCountResult[0]?.total_count || 0);
  const uniqueUsers = Number(uniqueUsersResult[0]?.unique_users || 0);
  const eventFrequencyPerUser = uniqueUsers > 0 ? totalEventCount / uniqueUsers : 0;

  return {
    eventFrequencyPerUser,
    totalEventCount,
    uniqueUsers,
  };
}
