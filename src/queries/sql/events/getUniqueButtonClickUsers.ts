import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface UniqueButtonClickUsersResult {
  uniqueUsers: number;
  totalClicks: number;
  eventName: string;
  period: {
    startDate: string;
    endDate: string;
  };
}

export async function getUniqueButtonClickUsers(
  ...args: [websiteId: string, startDate: Date, endDate: Date, eventName: string]
): Promise<UniqueButtonClickUsersResult> {
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
): Promise<UniqueButtonClickUsersResult> {
  const { rawQuery } = prisma;

  // Get unique users who clicked the specific button
  const uniqueUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      AND event_name = {{eventName}}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  // Get total clicks for this button
  const totalClicksResult = await rawQuery(
    `
    SELECT COUNT(*) as total_clicks
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      AND event_name = {{eventName}}
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  const uniqueUsers = Number(uniqueUsersResult[0]?.unique_users || 0);
  const totalClicks = Number(totalClicksResult[0]?.total_clicks || 0);

  return {
    uniqueUsers,
    totalClicks,
    eventName,
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
  eventName: string,
): Promise<UniqueButtonClickUsersResult> {
  const { rawQuery } = clickhouse;

  // Get unique users who clicked the specific button
  const uniqueUsersResult = await rawQuery(
    `
    SELECT COUNT(DISTINCT session_id) as unique_users
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

  // Get total clicks for this button
  const totalClicksResult = await rawQuery(
    `
    SELECT COUNT(*) as total_clicks
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

  const uniqueUsers = Number(uniqueUsersResult[0]?.unique_users || 0);
  const totalClicks = Number(totalClicksResult[0]?.total_clicks || 0);

  return {
    uniqueUsers,
    totalClicks,
    eventName,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
  };
}
