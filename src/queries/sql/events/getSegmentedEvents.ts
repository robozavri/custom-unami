import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface SegmentedEventsResult {
  segments: Array<{
    segment_type: string;
    segment_value: string;
    events_count: number;
    unique_users: number;
  }>;
}

export async function getSegmentedEvents(
  ...args: [
    websiteId: string,
    startDate: Date,
    endDate: Date,
    segmentBy: 'country' | 'device' | 'plan' | 'browser',
    eventName?: string,
  ]
): Promise<SegmentedEventsResult> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => clickhouseQuery(...args),
  });
}

async function relationalQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  segmentBy: 'country' | 'device' | 'plan' | 'browser',
  eventName?: string,
): Promise<SegmentedEventsResult> {
  const { rawQuery } = prisma;

  // Build event filter
  const eventFilter = eventName ? 'and e.event_name = {{eventName}}' : '';

  // Determine segment column based on segmentBy parameter
  let segmentColumn: string;

  switch (segmentBy) {
    case 'country':
      segmentColumn = 's.country';
      break;
    case 'device':
      segmentColumn = 's.device';
      break;
    case 'browser':
      segmentColumn = 's.browser';
      break;
    case 'plan':
      segmentColumn = 's.plan';
      break;
    default:
      segmentColumn = 's.device';
  }

  // Build the query - all segments come from session table
  const query = `
    SELECT 
      COALESCE(${segmentColumn}, 'Unknown') AS segment_value,
      COUNT(*) as events_count,
      COUNT(DISTINCT e.session_id) as unique_users
    FROM website_event e
    JOIN session s ON e.session_id = s.session_id
    WHERE e.website_id = {{websiteId::uuid}}
      AND e.created_at BETWEEN {{startDate}} AND {{endDate}}
      AND e.event_type = {{eventType}}
      ${eventFilter}
    GROUP BY ${segmentColumn}
    ORDER BY events_count DESC
  `;

  const params = { websiteId, startDate, endDate, eventType: EVENT_TYPE.customEvent, eventName };

  const result = await rawQuery(query, params);

  return {
    segments: result.map((row: any) => ({
      segment_type: segmentBy,
      segment_value: row.segment_value || 'Unknown',
      events_count: Number(row.events_count || 0),
      unique_users: Number(row.unique_users || 0),
    })),
  };
}

async function clickhouseQuery(
  websiteId: string,
  startDate: Date,
  endDate: Date,
  segmentBy: 'country' | 'device' | 'plan' | 'browser',
  eventName?: string,
): Promise<SegmentedEventsResult> {
  const { rawQuery } = clickhouse;

  // Build event filter
  const eventFilter = eventName ? 'AND e.event_name = {eventName:String}' : '';

  // Determine segment column based on segmentBy parameter
  let segmentColumn: string;

  switch (segmentBy) {
    case 'country':
      segmentColumn = 's.country';
      break;
    case 'device':
      segmentColumn = 's.device';
      break;
    case 'browser':
      segmentColumn = 's.browser';
      break;
    case 'plan':
      segmentColumn = 's.plan';
      break;
    default:
      segmentColumn = 's.device';
  }

  // Build the query - all segments come from session table
  const query = `
    SELECT 
      COALESCE(${segmentColumn}, 'Unknown') AS segment_value,
      COUNT(*) as events_count,
      COUNT(DISTINCT e.session_id) as unique_users
    FROM website_event e
    JOIN session s ON e.session_id = s.session_id
    WHERE e.website_id = {websiteId:UUID}
      AND e.created_at BETWEEN {startDate:DateTime64} AND {endDate:DateTime64}
      AND e.event_type = {eventType:UInt32}
      ${eventFilter}
    GROUP BY ${segmentColumn}
    ORDER BY events_count DESC
  `;

  const params = {
    websiteId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    eventType: EVENT_TYPE.customEvent,
    ...(eventName && { eventName }),
  };

  const result = await rawQuery(query, params);

  return {
    segments: Array.isArray(result)
      ? result.map((row: any) => ({
          segment_type: segmentBy,
          segment_value: row.segment_value || 'Unknown',
          events_count: Number(row.events_count || 0),
          unique_users: Number(row.unique_users || 0),
        }))
      : [],
  };
}
