import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventDropoffItem {
  eventName: string;
  sessionsWithEvent: number;
  dropoffSessions: number;
  dropoffRate: number; // 0-100
}

export interface EventDropoffsResult {
  websiteId: string;
  startDate: string;
  endDate: string;
  items: EventDropoffItem[];
}

export async function getEventDropoffs(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
  limit: number = 10,
): Promise<EventDropoffsResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, startDate, endDate, eventName, limit),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, startDate, endDate, eventName, limit),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
  limit: number = 10,
): Promise<EventDropoffsResult> {
  const { rawQuery } = prisma;

  const eventNameFilter = eventName ? 'AND we.event_name = {{eventName}}' : '';

  // For each session, find the last event; sessions where a given event is the last imply dropoff after that event
  const rows = await rawQuery(
    `
    WITH last_events AS (
      SELECT we.session_id, MAX(we.created_at) AS last_time
      FROM website_event we
      WHERE we.website_id = {{websiteId::uuid}}
        AND we.created_at BETWEEN {{startDate}} AND {{endDate}}
      GROUP BY we.session_id
    )
    SELECT 
      we.event_name,
      COUNT(DISTINCT we.session_id) FILTER (WHERE we.event_name IS NOT NULL) AS sessions_with_event,
      COUNT(DISTINCT we.session_id) FILTER (
        WHERE we.event_name IS NOT NULL AND we.created_at = le.last_time
      ) AS dropoff_sessions
    FROM website_event we
    JOIN last_events le
      ON le.session_id = we.session_id
    WHERE we.website_id = {{websiteId::uuid}}
      AND we.created_at BETWEEN {{startDate}} AND {{endDate}}
      ${eventNameFilter}
    GROUP BY we.event_name
    HAVING we.event_name IS NOT NULL
    ORDER BY (COUNT(DISTINCT we.session_id) FILTER (WHERE we.created_at = le.last_time)) DESC
    LIMIT {{limit}}
    `,
    { websiteId, startDate, endDate, eventName, limit },
  );

  const items: EventDropoffItem[] = rows.map((r: any) => {
    const sessionsWithEvent = Number(r.sessions_with_event || 0);
    const dropoffSessions = Number(r.dropoff_sessions || 0);
    const dropoffRate = sessionsWithEvent > 0 ? (dropoffSessions / sessionsWithEvent) * 100 : 0;
    return {
      eventName: r.event_name,
      sessionsWithEvent,
      dropoffSessions,
      dropoffRate,
    };
  });

  return {
    websiteId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    items,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
  limit: number = 10,
): Promise<EventDropoffsResult> {
  const { rawQuery } = clickhouse;

  const eventNameFilter = eventName ? 'AND we.event_name = {eventName:String}' : '';

  const rows = await rawQuery(
    `
    WITH last_events AS (
      SELECT 
        session_id,
        max(created_at) AS last_time
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      GROUP BY session_id
    )
    SELECT 
      we.event_name AS event_name,
      uniqExactIf(we.session_id, we.event_name IS NOT NULL) AS sessions_with_event,
      uniqExactIf(we.session_id, we.event_name IS NOT NULL AND we.created_at = le.last_time) AS dropoff_sessions
    FROM website_event we
    INNER JOIN last_events le
      ON le.session_id = we.session_id
    WHERE we.website_id = {websiteId:UUID}
      AND we.created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      ${eventNameFilter}
    GROUP BY we.event_name
    HAVING event_name IS NOT NULL
    ORDER BY dropoff_sessions DESC
    LIMIT {limit:UInt32}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventName && { eventName }),
      limit,
    },
  );

  const items: EventDropoffItem[] = (rows as any[]).map(r => {
    const sessionsWithEvent = Number(r.sessions_with_event || 0);
    const dropoffSessions = Number(r.dropoff_sessions || 0);
    const dropoffRate = sessionsWithEvent > 0 ? (dropoffSessions / sessionsWithEvent) * 100 : 0;
    return {
      eventName: r.event_name,
      sessionsWithEvent,
      dropoffSessions,
      dropoffRate,
    };
  });

  return {
    websiteId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    items,
  };
}
