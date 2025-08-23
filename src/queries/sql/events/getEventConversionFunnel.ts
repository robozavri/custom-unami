import clickhouse from '@/lib/clickhouse';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventConversionFunnelResult {
  eventX?: string;
  eventY?: string;
  startedSessions: number;
  convertedSessions: number;
  conversionRate: number; // percentage 0-100
}

export async function getEventConversionFunnel(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventX?: string,
  eventY?: string,
): Promise<EventConversionFunnelResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(websiteId, startDate, endDate, eventX, eventY),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, startDate, endDate, eventX, eventY),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventX?: string,
  eventY?: string,
): Promise<EventConversionFunnelResult> {
  const { rawQuery } = prisma;

  // Defaults: if no X specified, use page views (event_type = 1). If no Y specified, use custom events (event_type = 2)
  const xFilter = eventX ? 'we1.event_name = {{eventX}}' : 'we1.event_type = 1';
  const yFilter = eventY ? 'we2.event_name = {{eventY}}' : 'we2.event_type = 2';

  // Sessions with X during period
  const startedRows = await rawQuery(
    `
    SELECT COUNT(DISTINCT we1.session_id) as started_sessions
    FROM website_event we1
    WHERE we1.website_id = {{websiteId::uuid}}
      AND we1.created_at BETWEEN {{startDate}} AND {{endDate}}
      AND ${xFilter}
    `,
    { websiteId, startDate, endDate, eventX, eventY },
  );

  const startedSessions = Number(startedRows[0]?.started_sessions || 0);

  // Sessions where Y occurs AFTER X
  const convertedRows = await rawQuery(
    `
    SELECT COUNT(DISTINCT we1.session_id) as converted_sessions
    FROM website_event we1
    JOIN website_event we2
      ON we2.website_id = we1.website_id
     AND we2.session_id = we1.session_id
     AND we2.created_at > we1.created_at
    WHERE we1.website_id = {{websiteId::uuid}}
      AND we1.created_at BETWEEN {{startDate}} AND {{endDate}}
      AND ${xFilter}
      AND ${yFilter}
    `,
    { websiteId, startDate, endDate, eventX, eventY },
  );

  const convertedSessions = Number(convertedRows[0]?.converted_sessions || 0);
  const conversionRate = startedSessions > 0 ? (convertedSessions / startedSessions) * 100 : 0;

  return {
    eventX,
    eventY,
    startedSessions,
    convertedSessions,
    conversionRate,
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  eventX?: string,
  eventY?: string,
): Promise<EventConversionFunnelResult> {
  const { rawQuery } = clickhouse;

  const xFilter = eventX ? 'we1.event_name = {eventX:String}' : 'we1.event_type = 1';
  const yFilter = eventY ? 'we2.event_name = {eventY:String}' : 'we2.event_type = 2';

  const startedRows = await rawQuery(
    `
    SELECT COUNT(DISTINCT we1.session_id) as started_sessions
    FROM website_event we1
    WHERE we1.website_id = {websiteId:UUID}
      AND we1.created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND ${xFilter}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventX && { eventX }),
      ...(eventY && { eventY }),
    },
  );

  const startedSessions = Number((startedRows as any[])[0]?.started_sessions || 0);

  const convertedRows = await rawQuery(
    `
    SELECT COUNT(DISTINCT we1.session_id) as converted_sessions
    FROM website_event we1
    INNER JOIN website_event we2
      ON we2.website_id = we1.website_id
     AND we2.session_id = we1.session_id
     AND we2.created_at > we1.created_at
    WHERE we1.website_id = {websiteId:UUID}
      AND we1.created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND ${xFilter}
      AND ${yFilter}
    `,
    {
      websiteId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...(eventX && { eventX }),
      ...(eventY && { eventY }),
    },
  );

  const convertedSessions = Number((convertedRows as any[])[0]?.converted_sessions || 0);
  const conversionRate = startedSessions > 0 ? (convertedSessions / startedSessions) * 100 : 0;

  return {
    eventX,
    eventY,
    startedSessions,
    convertedSessions,
    conversionRate,
  };
}
