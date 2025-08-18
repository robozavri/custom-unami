import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface EventsForCtrParams {
  websiteId: string;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
}

export interface CtrEventRow {
  session_id: string;
  created_at: Date;
  event_type: number; // 1=pageview, 2=custom
  event_name: string | null;
  url_path: string | null;
  utm_source: string | null;
  device: string | null;
  country: string | null;
}

export async function getEventsForCtr(params: EventsForCtrParams): Promise<CtrEventRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(params: EventsForCtrParams): Promise<CtrEventRow[]> {
  const { websiteId, date_from, date_to } = params;

  const query = `
    SELECT
      we.session_id,
      we.created_at,
      we.event_type,
      we.event_name,
      we.url_path,
      we.utm_source,
      s.device,
      s.country
    FROM website_event we
    LEFT JOIN session s ON s.session_id = we.session_id AND s.website_id = we.website_id
    WHERE we.website_id = $1::uuid
      AND we.created_at >= $2::timestamptz
      AND we.created_at < ($3::timestamptz + interval '1 day')
  `;

  const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to);
  return result as CtrEventRow[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
async function clickhouseQuery(params: EventsForCtrParams): Promise<CtrEventRow[]> {
  // TODO: implement ClickHouse version
  void params;
  return [];
}
