import clickhouse from '@/lib/clickhouse';
// import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventFrequencyDistributionResult {
  usersWithOneEvent: number;
  usersWithMultipleEvents: number;
  totalUniqueUsers: number;
  eventName?: string;
  breakdown: {
    eventCount: number;
    userCount: number;
  }[];
}

export async function getEventFrequencyDistribution(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
  eventType?: number,
): Promise<EventFrequencyDistributionResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, startDate, endDate, eventName, eventType),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, startDate, endDate, eventName, eventType),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
  eventType?: number,
): Promise<EventFrequencyDistributionResult> {
  const { rawQuery } = prisma;

  // Build event filter
  const eventFilter = eventName ? 'and event_name = {{eventName}}' : '';

  // Get event frequency distribution per user
  const distributionResult = await rawQuery(
    `
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as user_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
        ${eventType !== undefined ? 'AND event_type = {{eventType}}' : ''}
        ${eventFilter}
      GROUP BY session_id
    ) user_event_counts
    GROUP BY event_count
    ORDER BY event_count
    `,
    { websiteId, startDate, endDate, ...(eventType !== undefined && { eventType }), eventName },
  );

  // Get total unique users
  const totalUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      ${eventType !== undefined ? 'AND event_type = {{eventType}}' : ''}
      ${eventFilter}
    `,
    { websiteId, startDate, endDate, ...(eventType !== undefined && { eventType }), eventName },
  );

  const totalUniqueUsers = Number(totalUsersResult[0]?.total_users || 0);

  // Process distribution results
  let usersWithOneEvent = 0;
  let usersWithMultipleEvents = 0;
  const breakdown: { eventCount: number; userCount: number }[] = [];

  for (const row of distributionResult) {
    const eventCount = Number(row.event_count);
    const userCount = Number(row.user_count);

    breakdown.push({ eventCount, userCount });

    if (eventCount === 1) {
      usersWithOneEvent = userCount;
    } else {
      usersWithMultipleEvents += userCount;
    }
  }

  return {
    usersWithOneEvent,
    usersWithMultipleEvents,
    totalUniqueUsers,
    eventName,
    breakdown,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
  eventType?: number,
): Promise<EventFrequencyDistributionResult> {
  const { rawQuery } = clickhouse;

  // Build event filter
  const eventFilter = eventName ? 'AND event_name = {eventName:String}' : '';

  // Get event frequency distribution per user
  const distributionResult = await rawQuery(
    `
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as user_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
        ${eventType !== undefined ? 'AND event_type = {eventType:UInt32}' : ''}
        ${eventFilter}
      GROUP BY session_id
    ) user_event_counts
    GROUP BY event_count
    ORDER BY event_count
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventType !== undefined && { eventType }),
      ...(eventName && { eventName }),
    },
  );

  // Get total unique users
  const totalUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      ${eventType !== undefined ? 'AND event_type = {eventType:UInt32}' : ''}
      ${eventFilter}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventType !== undefined && { eventType }),
      ...(eventName && { eventName }),
    },
  );

  const totalUniqueUsers = Number(totalUsersResult[0]?.total_users || 0);

  // Process distribution results
  let usersWithOneEvent = 0;
  let usersWithMultipleEvents = 0;
  const breakdown: { eventCount: number; userCount: number }[] = [];

  for (const row of distributionResult as any[]) {
    const eventCount = Number(row.event_count);
    const userCount = Number(row.user_count);

    breakdown.push({ eventCount, userCount });

    if (eventCount === 1) {
      usersWithOneEvent = userCount;
    } else {
      usersWithMultipleEvents += userCount;
    }
  }

  return {
    usersWithOneEvent,
    usersWithMultipleEvents,
    totalUniqueUsers,
    eventName,
    breakdown,
  };
}
