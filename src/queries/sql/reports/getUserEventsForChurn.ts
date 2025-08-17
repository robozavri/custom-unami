import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface UserEventsForChurnParams {
  websiteId: string;
  date_from: string; // ISO date (inclusive start of analysis window)
  date_to: string; // ISO date (exclusive end boundary or end of day will be handled in SQL)
}

export interface UserEventRow {
  session_id: string;
  user_created_at: Date;
  event_time: Date | null;
}

export async function getUserEventsForChurn(
  params: UserEventsForChurnParams,
): Promise<UserEventRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(params),
  });
}

async function relationalQuery(params: UserEventsForChurnParams): Promise<UserEventRow[]> {
  const { websiteId, date_from, date_to } = params;

  // Fetch all sessions created before date_to, and any events for those sessions before date_to.
  // Include sessions even if they have no events (LEFT JOIN) so that inactivity churn can be computed.
  const query = `
    SELECT
      s.session_id,
      s.created_at AS user_created_at,
      we.created_at AS event_time
    FROM session s
    LEFT JOIN website_event we
      ON we.session_id = s.session_id
     AND we.website_id = s.website_id
     AND we.created_at < $3::timestamptz + interval '1 day'
    WHERE s.website_id = $1::uuid
      AND s.created_at < $3::timestamptz + interval '1 day'
      -- Optional lower bound to limit scan; adjust if needed
      AND s.created_at >= $2::timestamptz - interval '365 days'
  `;

  const result = (await prisma.client.$queryRawUnsafe(
    query,
    websiteId,
    date_from,
    date_to,
  )) as Array<{ session_id: string; user_created_at: Date; event_time: Date | null }>;

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
async function clickhouseQuery(params: UserEventsForChurnParams): Promise<UserEventRow[]> {
  throw new Error('ClickHouse implementation not yet available for getUserEventsForChurn');
}
