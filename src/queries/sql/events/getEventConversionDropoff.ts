import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventConversionDropoffResult {
  conversionRate: number;
  dropoffRate: number;
  eventRatio: number;
  totalUsers: number;
  usersWithEvent: number;
  usersWithNextEvent: number;
  eventACount: number;
  eventBCount: number;
  summary: {
    conversion_percentage: number;
    dropoff_percentage: number;
    ratio_value: number;
  };
}

export async function getEventConversionDropoff(
  ...args: [
    websiteId: string,
    startDate: Date,
    endDate: Date,
    eventName: string,
    nextEventName?: string,
    eventA?: string,
    eventB?: string,
  ]
): Promise<EventConversionDropoffResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName: string,
  nextEventName?: string,
  eventA?: string,
  eventB?: string,
): Promise<EventConversionDropoffResult> {
  const { rawQuery } = prisma;

  // Get total unique users in the date range
  const totalUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
    `,
    { websiteId, startDate, endDate },
  );

  // Get users who triggered the main event
  const usersWithEventResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as users_with_event
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      AND event_name = {{eventName}}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  // Get users who triggered the next event (for drop-off calculation)
  let usersWithNextEvent = 0;
  if (nextEventName) {
    const nextEventResult = await rawQuery(
      `
      SELECT COUNT(DISTINCT session_id) as users_with_next_event
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
        AND event_type = {{eventType}}
        AND event_name = {{nextEventName}}
      `,
      {
        websiteId,
        startDate,
        endDate,
        eventType: EVENT_TYPE.customEvent,
        eventName: nextEventName,
      },
    );
    usersWithNextEvent = Number(nextEventResult[0]?.users_with_next_event || 0);
  }

  // Get event A count (for ratio calculation)
  let eventACount = 0;
  if (eventA) {
    const eventAResult = await rawQuery(
      `
      SELECT COUNT(*) as event_a_count
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
        AND event_type = {{eventType}}
        AND event_name = {{eventA}}
      `,
      { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName: eventA },
    );
    eventACount = Number(eventAResult[0]?.event_a_count || 0);
  }

  // Get event B count (for ratio calculation)
  let eventBCount = 0;
  if (eventB) {
    const eventBResult = await rawQuery(
      `
      SELECT COUNT(*) as event_b_count
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
        AND event_type = {{eventType}}
        AND event_name = {{eventB}}
      `,
      { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName: eventB },
    );
    eventBCount = Number(eventBResult[0]?.event_b_count || 0);
  }

  const totalUsers = Number(totalUsersResult[0]?.total_users || 0);
  const usersWithEvent = Number(usersWithEventResult[0]?.users_with_event || 0);

  // Calculate metrics
  const conversionRate = totalUsers > 0 ? (usersWithEvent / totalUsers) * 100 : 0;
  const dropoffRate = usersWithEvent > 0 ? (1 - usersWithNextEvent / usersWithEvent) * 100 : 0;
  const eventRatio = eventBCount > 0 ? eventACount / eventBCount : 0;

  return {
    conversionRate,
    dropoffRate,
    eventRatio,
    totalUsers,
    usersWithEvent,
    usersWithNextEvent,
    eventACount,
    eventBCount,
    summary: {
      conversion_percentage: Math.round(conversionRate * 100) / 100,
      dropoff_percentage: Math.round(dropoffRate * 100) / 100,
      ratio_value: Math.round(eventRatio * 100) / 100,
    },
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName: string,
  nextEventName?: string,
  eventA?: string,
  eventB?: string,
): Promise<EventConversionDropoffResult> {
  const { rawQuery } = clickhouse;

  // Get total unique users in the date range
  const totalUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as total_users
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
    `,
    { websiteId, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  );

  // Get users who triggered the main event
  const usersWithEventResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as users_with_event
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
      AND event_name = {eventName:String}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      eventName,
    },
  );

  // Get users who triggered the next event (for drop-off calculation)
  let usersWithNextEvent = 0;
  if (nextEventName) {
    const nextEventResult = await rawQuery(
      `
      SELECT COUNT(DISTINCT session_id) as users_with_next_event
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
        AND event_type = {eventType:UInt32}
        AND event_name = {nextEventName:String}
      `,
      {
        websiteId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType: EVENT_TYPE.customEvent,
        eventName: nextEventName,
      },
    );
    usersWithNextEvent = Number(nextEventResult[0]?.users_with_next_event || 0);
  }

  // Get event A count (for ratio calculation)
  let eventACount = 0;
  if (eventA) {
    const eventAResult = await rawQuery(
      `
      SELECT COUNT(*) as event_a_count
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
        AND event_type = {eventType:UInt32}
        AND event_name = {eventA:String}
      `,
      {
        websiteId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType: EVENT_TYPE.customEvent,
        eventName: eventA,
      },
    );
    eventACount = Number(eventAResult[0]?.event_a_count || 0);
  }

  // Get event B count (for ratio calculation)
  let eventBCount = 0;
  if (eventB) {
    const eventBResult = await rawQuery(
      `
      SELECT COUNT(*) as event_b_count
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
        AND event_type = {eventType:UInt32}
        AND event_name = {eventB:String}
      `,
      {
        websiteId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType: EVENT_TYPE.customEvent,
        eventName: eventB,
      },
    );
    eventBCount = Number(eventBResult[0]?.event_b_count || 0);
  }

  const totalUsers = Number(totalUsersResult[0]?.total_users || 0);
  const usersWithEvent = Number(usersWithEventResult[0]?.users_with_event || 0);

  // Calculate metrics
  const conversionRate = totalUsers > 0 ? (usersWithEvent / totalUsers) * 100 : 0;
  const dropoffRate = usersWithEvent > 0 ? (1 - usersWithNextEvent / usersWithEvent) * 100 : 0;
  const eventRatio = eventBCount > 0 ? eventACount / eventBCount : 0;

  return {
    conversionRate,
    dropoffRate,
    eventRatio,
    totalUsers,
    usersWithEvent,
    usersWithNextEvent,
    eventACount,
    eventBCount,
    summary: {
      conversion_percentage: Math.round(conversionRate * 100) / 100,
      dropoff_percentage: Math.round(dropoffRate * 100) / 100,
      ratio_value: Math.round(eventRatio * 100) / 100,
    },
  };
}
