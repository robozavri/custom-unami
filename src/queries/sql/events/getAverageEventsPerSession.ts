import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface AverageEventsPerSessionResult {
  averageEventsPerSession: number;
  totalSessions: number;
  totalEvents: number;
  eventName?: string;
  breakdown: {
    sessionCount: number;
    eventCount: number;
    percentage: number;
  }[];
}

export async function getAverageEventsPerSession(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<AverageEventsPerSessionResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, startDate, endDate, eventName),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, startDate, endDate, eventName),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<AverageEventsPerSessionResult> {
  const { rawQuery } = prisma;

  // Build event filter
  const eventFilter = eventName ? 'AND event_name = {{eventName}}' : '';

  // Get total events and sessions
  const totalResult = await rawQuery(
    `
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT session_id) as total_sessions
    FROM website_event
    WHERE website_id = {{websiteId::uuid}}
      AND created_at BETWEEN {{startDate}} AND {{endDate}}
      ${eventFilter}
    `,
    { websiteId, startDate, endDate, eventName },
  );

  const totalEvents = Number(totalResult[0]?.total_events || 0);
  const totalSessions = Number(totalResult[0]?.total_sessions || 0);

  // Get breakdown of events per session
  const breakdownResult = await rawQuery(
    `
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as session_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
        ${eventFilter}
      GROUP BY session_id
    ) session_event_counts
    GROUP BY event_count
    ORDER BY event_count
    `,
    { websiteId, startDate, endDate, eventName },
  );

  const breakdown = breakdownResult.map((row: any) => ({
    sessionCount: Number(row.session_count),
    eventCount: Number(row.event_count),
    percentage: totalSessions > 0 ? (Number(row.session_count) / totalSessions) * 100 : 0,
  }));

  const averageEventsPerSession = totalSessions > 0 ? totalEvents / totalSessions : 0;

  return {
    averageEventsPerSession,
    totalSessions,
    totalEvents,
    eventName,
    breakdown,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<AverageEventsPerSessionResult> {
  const { rawQuery } = clickhouse;

  // Build event filter
  const eventFilter = eventName ? 'AND event_name = {eventName:String}' : '';

  // Get total events and sessions
  const totalResult = await rawQuery(
    `
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT session_id) as total_sessions
    FROM website_event
    WHERE website_id = {websiteId:UUID}
      AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      ${eventFilter}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventName && { eventName }),
    },
  );

  const totalEvents = Number(totalResult[0]?.total_events || 0);
  const totalSessions = Number(totalResult[0]?.total_sessions || 0);

  // Get breakdown of events per session
  const breakdownResult = await rawQuery(
    `
    SELECT 
      event_count,
      COUNT(DISTINCT session_id) as session_count
    FROM (
      SELECT 
        session_id,
        COUNT(*) as event_count
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
        ${eventFilter}
      GROUP BY session_id
    ) session_event_counts
    GROUP BY event_count
    ORDER BY event_count
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventName && { eventName }),
    },
  );

  const breakdown = Array.isArray(breakdownResult)
    ? breakdownResult.map((row: any) => ({
        sessionCount: Number(row.session_count),
        eventCount: Number(row.event_count),
        percentage: totalSessions > 0 ? (Number(row.session_count) / totalSessions) * 100 : 0,
      }))
    : [];

  const averageEventsPerSession = totalSessions > 0 ? totalEvents / totalSessions : 0;

  return {
    averageEventsPerSession,
    totalSessions,
    totalEvents,
    eventName,
    breakdown,
  };
}
