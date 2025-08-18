import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface TotalEventCountResult {
  totalEventCount: number;
}

export async function getTotalEventCount(
  ...args: [websiteId: string, startDate: Date, endDate: Date, eventName?: string]
): Promise<TotalEventCountResult> {
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
): Promise<TotalEventCountResult> {
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

  const totalEventCount = Number(totalCountResult[0]?.total_count || 0);

  return {
    totalEventCount,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<TotalEventCountResult> {
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

  const totalEventCount = Number(totalCountResult[0]?.total_count || 0);

  return {
    totalEventCount,
  };
}
