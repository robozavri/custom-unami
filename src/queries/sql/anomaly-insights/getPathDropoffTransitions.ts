import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

export interface PathDropoffTransitionsParams {
  websiteId: string;
  date_from: string;
  date_to: string;
  timezone?: string;
  min_support?: number;
  normalize_paths?: boolean;
}

export interface TransitionRow {
  from_path: string | null;
  to_path: string | null;
  transitions: number;
}

export async function getPathDropoffTransitions(
  params: PathDropoffTransitionsParams,
): Promise<TransitionRow[]> {
  return runQuery({
    [PRISMA]: () => relationalQuery(params),
    [CLICKHOUSE]: () => clickhouseQuery(),
  });
}

async function relationalQuery(params: PathDropoffTransitionsParams): Promise<TransitionRow[]> {
  const { websiteId, date_from, date_to, normalize_paths = true } = params;

  // Path normalization SQL
  const pathNormalization = normalize_paths
    ? `lower(regexp_replace(url_path, '(\\?.*)|(\\#.*)$', ''))`
    : 'url_path';

  const query = `
    WITH pageviews AS (
      SELECT
        visit_id,
        created_at,
        ${pathNormalization} AS path,
        ROW_NUMBER() OVER (PARTITION BY visit_id ORDER BY created_at) AS rn
      FROM website_event
      WHERE website_id = $1::uuid
        AND event_type = 1
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz + interval '1 day'
    )
    SELECT
      a.path AS from_path,
      b.path AS to_path,
      COUNT(*)::bigint AS transitions
    FROM pageviews a
    LEFT JOIN pageviews b
      ON a.visit_id = b.visit_id AND b.rn = a.rn + 1
    GROUP BY a.path, b.path
    ORDER BY transitions DESC
  `;

  const result = await prisma.client.$queryRawUnsafe(query, websiteId, date_from, date_to);

  return result as TransitionRow[];
}

async function clickhouseQuery(): Promise<TransitionRow[]> {
  // ClickHouse implementation is pending
  // For now, throw error as ClickHouse implementation is not yet available
  throw new Error('ClickHouse implementation not yet available for path drop-off detection');
}
