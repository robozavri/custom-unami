import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventsPerPeriodResult {
  periods: Array<{
    period: string;
    events_count: number;
    unique_users: number;
  }>;
}

export async function getEventsPerPeriod(
  ...args: [
    websiteId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month',
    eventName?: string,
  ]
): Promise<EventsPerPeriodResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month',
  eventName?: string,
): Promise<EventsPerPeriodResult> {
  const { rawQuery } = prisma;

  // Build event filter
  const eventFilter = eventName ? 'and event_name = {{eventName}}' : '';

  // Determine date trunc function based on granularity
  const dateTrunc = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';

  const result = await rawQuery(
    `
    SELECT 
      date_trunc('${dateTrunc}', created_at) AS period,
      COUNT(*) as events_count,
      COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      AND event_type = {{eventType}}
      ${eventFilter}
    GROUP BY date_trunc('${dateTrunc}', created_at)
    ORDER BY period
    `,
    { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName },
  );

  return {
    periods: result.map((row: any) => ({
      period: row.period,
      events_count: Number(row.events_count || 0),
      unique_users: Number(row.unique_users || 0),
    })),
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month',
  eventName?: string,
): Promise<EventsPerPeriodResult> {
  const { rawQuery } = clickhouse;

  // Build event filter
  const eventFilter = eventName ? 'AND event_name = {eventName:String}' : '';

  // Determine date trunc function based on granularity
  const dateTrunc =
    granularity === 'day'
      ? 'toStartOfDay'
      : granularity === 'week'
      ? 'toStartOfWeek'
      : 'toStartOfMonth';

  const result = await rawQuery(
    `
    SELECT 
      ${dateTrunc}(created_at) AS period,
      COUNT(*) as events_count,
      COUNT(DISTINCT session_id) as unique_users
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND event_type = {eventType:UInt32}
      ${eventFilter}
    GROUP BY ${dateTrunc}(created_at)
    ORDER BY period
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventType: EVENT_TYPE.customEvent,
      ...(eventName && { eventName }),
    },
  );

  return {
    periods: Array.isArray(result)
      ? result.map((row: any) => ({
          period: row.period,
          events_count: Number(row.events_count || 0),
          unique_users: Number(row.unique_users || 0),
        }))
      : [],
  };
}
