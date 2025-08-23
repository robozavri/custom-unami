import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface NewUserFirstDayEventRateResult {
  totalSessions: number;
  sessionsWithEventOnFirstDay: number;
  percentage: number; // 0-100
  eventName?: string;
}

export async function getNewUserFirstDayEventRate(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<NewUserFirstDayEventRateResult> {
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
): Promise<NewUserFirstDayEventRateResult> {
  const { rawQuery } = prisma;

  // Total sessions whose first event falls within the range
  const totalRows = await rawQuery(
    `
    WITH firsts AS (
      SELECT session_id, MIN(created_at) AS first_time
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
      GROUP BY session_id
    )
    SELECT COUNT(*) AS total_sessions FROM firsts
    `,
    { websiteId, startDate, endDate },
  );

  const totalSessions = Number(totalRows[0]?.total_sessions || 0);

  // Sessions that had event X (or any custom event) on their first day
  const sessionsWithRows = await rawQuery(
    `
    WITH firsts AS (
      SELECT session_id, MIN(created_at) AS first_time
      FROM website_event
      WHERE website_id = {{websiteId::uuid}}
        AND created_at BETWEEN {{startDate}} AND {{endDate}}
      GROUP BY session_id
    )
    SELECT COUNT(DISTINCT we.session_id) AS sessions_with_event
    FROM website_event we
    JOIN firsts f ON f.session_id = we.session_id
    WHERE we.website_id = {{websiteId::uuid}}
      AND DATE_TRUNC('day', we.created_at) = DATE_TRUNC('day', f.first_time)
      AND ${eventName ? 'we.event_name = {{eventName}}' : 'we.event_type = 2'}
    `,
    { websiteId, startDate, endDate, eventName },
  );

  const sessionsWithEventOnFirstDay = Number(sessionsWithRows[0]?.sessions_with_event || 0);
  const percentage = totalSessions > 0 ? (sessionsWithEventOnFirstDay / totalSessions) * 100 : 0;

  return { totalSessions, sessionsWithEventOnFirstDay, percentage, eventName };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventName?: string,
): Promise<NewUserFirstDayEventRateResult> {
  const { rawQuery } = clickhouse;

  const totalRows = await rawQuery(
    `
    WITH firsts AS (
      SELECT session_id, min(created_at) AS first_time
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      GROUP BY session_id
    )
    SELECT count() AS total_sessions FROM firsts
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  );

  const totalSessions = Number((totalRows as any[])[0]?.total_sessions || 0);

  const sessionsWithRows = await rawQuery(
    `
    WITH firsts AS (
      SELECT session_id, min(created_at) AS first_time
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      GROUP BY session_id
    )
    SELECT uniqExact(we.session_id) AS sessions_with_event
    FROM website_event we
    INNER JOIN firsts f ON f.session_id = we.session_id
    WHERE we.website_id = {websiteId:UUID}
      AND toDate(we.created_at) = toDate(f.first_time)
      AND ${eventName ? 'we.event_name = {eventName:String}' : 'we.event_type = 2'}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventName && { eventName }),
    },
  );

  const sessionsWithEventOnFirstDay = Number(
    (sessionsWithRows as any[])[0]?.sessions_with_event || 0,
  );
  const percentage = totalSessions > 0 ? (sessionsWithEventOnFirstDay / totalSessions) * 100 : 0;

  return { totalSessions, sessionsWithEventOnFirstDay, percentage, eventName };
}
