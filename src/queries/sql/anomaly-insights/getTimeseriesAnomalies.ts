import { CLICKHOUSE, PRISMA, POSTGRESQL } from '@/lib/db';

// Database agnostic date formatting functions
function getDateTruncSQL(field: string, interval: string, dbType: string): string {
  switch (dbType) {
    case CLICKHOUSE:
      if (interval === 'hour') return `toStartOfHour(${field})`;
      if (interval === 'week') return `toStartOfWeek(${field})`;
      return `toDate(${field})`;
    case PRISMA:
    default:
      if (interval === 'hour') return `date_trunc('hour', ${field})`;
      if (interval === 'week') return `date_trunc('week', ${field})`;
      return `date_trunc('day', ${field})`;
  }
}

function getDateRangeSQL(dbType: string): string {
  switch (dbType) {
    case CLICKHOUSE:
      return `created_at >= parseDateTimeBestEffort({date_from:String}) AND created_at < parseDateTimeBestEffort({date_to:String}) + INTERVAL 1 DAY`;
    case POSTGRESQL:
      return `created_at >= $2::timestamptz AND created_at < $3::timestamptz + interval '1 day'`;
    default:
      // MySQL or others handled by Prisma
      return `created_at >= $2 AND created_at < $3 + interval 1 day`;
  }
}

export const getTimeseriesAnomaliesQueries = {
  [CLICKHOUSE]: {
    visits: (interval: string) => `
      WITH
        ${getDateTruncSQL('created_at', interval, CLICKHOUSE)} AS d
      SELECT
        d AS bucket,
        uniq(visit_id) AS value
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND ${getDateRangeSQL(CLICKHOUSE)}
      GROUP BY bucket
      ORDER BY bucket`,

    pageviews: (interval: string) => `
      WITH
        ${getDateTruncSQL('created_at', interval, CLICKHOUSE)} AS d
      SELECT
        d AS bucket,
        countIf(event_type = 1) AS value
      FROM website_event
      WHERE website_id = {websiteId:UUID}
        AND ${getDateRangeSQL(CLICKHOUSE)}
      GROUP BY bucket
      ORDER BY bucket`,

    bounce_rate: (interval: string) => `
      WITH
        ${getDateTruncSQL('created_at', interval, CLICKHOUSE)} AS d
      SELECT
        d AS bucket,
        uniq(visit_id) AS visits,
        countIf(views_per_visit = 1) AS bounces,
        bounces / nullIf(visits, 0) AS value
      FROM (
        SELECT
          visit_id, d,
          sumIf(1, event_type = 1) AS views_per_visit
        FROM website_event
        WHERE website_id = {websiteId:UUID}
          AND ${getDateRangeSQL(CLICKHOUSE)}
        GROUP BY visit_id, d
      )
      GROUP BY bucket
      ORDER BY bucket`,

    visit_duration: (interval: string) => `
      WITH
        ${getDateTruncSQL('created_at', interval, CLICKHOUSE)} AS d
      SELECT
        d AS bucket,
        avg(duration_seconds) AS value
      FROM (
        SELECT
          visit_id, d,
          max(created_at) - min(created_at) AS duration_seconds
        FROM website_event
        WHERE website_id = {websiteId:UUID}
          AND ${getDateRangeSQL(CLICKHOUSE)}
        GROUP BY visit_id, d
      )
      GROUP BY bucket
      ORDER BY bucket`,
  },

  [PRISMA]: {
    visits: (interval: string, dbType: string) => {
      const dateTrunc = getDateTruncSQL('created_at', interval, dbType);
      const dateRange = getDateRangeSQL(dbType);
      const websiteIdParam = dbType === POSTGRESQL ? '$1::uuid' : '$1';

      return `
        SELECT 
          ${dateTrunc} AS bucket,
          COUNT(DISTINCT visit_id) AS value
        FROM website_event 
        WHERE website_id = ${websiteIdParam} 
          AND ${dateRange}
        GROUP BY ${dateTrunc}
        ORDER BY ${dateTrunc}`;
    },

    pageviews: (interval: string, dbType: string) => {
      const dateTrunc = getDateTruncSQL('created_at', interval, dbType);
      const dateRange = getDateRangeSQL(dbType);
      const websiteIdParam = dbType === POSTGRESQL ? '$1::uuid' : '$1';

      return `
        SELECT 
          ${dateTrunc} AS bucket,
          COUNT(CASE WHEN event_type = 1 THEN 1 END) AS value
        FROM website_event 
        WHERE website_id = ${websiteIdParam} 
          AND ${dateRange}
        GROUP BY ${dateTrunc}
        ORDER BY ${dateTrunc}`;
    },

    bounce_rate: (interval: string, dbType: string) => {
      const dateTrunc = getDateTruncSQL('created_at', interval, dbType);
      const dateRange = getDateRangeSQL(dbType);
      const websiteIdParam = dbType === POSTGRESQL ? '$1::uuid' : '$1';

      return `
        WITH visit_stats AS (
          SELECT 
            ${dateTrunc} AS bucket,
            visit_id,
            COUNT(CASE WHEN event_type = 1 THEN 1 END) AS views_per_visit
          FROM website_event 
          WHERE website_id = ${websiteIdParam} 
            AND ${dateRange}
          GROUP BY ${dateTrunc}, visit_id
        )
        SELECT 
          bucket,
          COUNT(DISTINCT visit_id) AS visits,
          COUNT(CASE WHEN views_per_visit = 1 THEN 1 END) AS bounces,
          CASE 
            WHEN COUNT(DISTINCT visit_id) > 0 
            THEN COUNT(CASE WHEN views_per_visit = 1 THEN 1 END)::float / COUNT(DISTINCT visit_id)
            ELSE 0 
          END AS value
        FROM visit_stats
        GROUP BY bucket
        ORDER BY bucket`;
    },

    visit_duration: (interval: string, dbType: string) => {
      const dateTrunc = getDateTruncSQL('created_at', interval, dbType);
      const dateRange = getDateRangeSQL(dbType);
      const websiteIdParam = dbType === POSTGRESQL ? '$1::uuid' : '$1';

      return `
        WITH visit_durations AS (
          SELECT 
            ${dateTrunc} AS bucket,
            visit_id,
            EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) AS duration_seconds
          FROM website_event 
          WHERE website_id = ${websiteIdParam} 
            AND ${dateRange}
          GROUP BY ${dateTrunc}, visit_id
        )
        SELECT 
          bucket,
          AVG(duration_seconds) AS value
        FROM visit_durations
        GROUP BY bucket
        ORDER BY bucket`;
    },
  },
};
