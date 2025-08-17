// import debug from 'debug';
import { z } from 'zod';
import { runQuery, getDatabaseType, CLICKHOUSE, PRISMA, POSTGRESQL } from '@/lib/db';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { DEFAULT_WEBSITE_ID } from '../../config';

// const log = debug('umami:anomaly:timeseries');

const metricEnum = z.enum(['visits', 'pageviews', 'bounce_rate', 'visit_duration']);
const intervalEnum = z.enum(['hour', 'day', 'week']);
const sensitivityEnum = z.enum(['low', 'medium', 'high']);

const inputSchema = z.object({
  metric: metricEnum,
  websiteId: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  interval: intervalEnum.default('day'),
  sensitivity: sensitivityEnum.default('medium'),
});

type Input = z.infer<typeof inputSchema>;

// Sensitivity thresholds for anomaly detection
const SENSITIVITY_THRESHOLDS = {
  low: 3.0,
  medium: 2.5,
  high: 2.0,
};

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

// Calculate Median Absolute Deviation (MAD)
function calculateMAD(values: number[]): number {
  if (values.length === 0) return 0;

  const median = calculateMedian(values);
  const deviations = values.map(v => Math.abs(v - median));
  const madMedian = calculateMedian(deviations);

  // Convert MAD to standard deviation approximation: σ ≈ 1.4826 * MAD
  return 1.4826 * madMedian;
}

// Calculate median
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

// Detect anomalies using z-score method
function detectAnomalies(
  series: Array<{ bucket: string; value: number }>,
  sensitivity: 'low' | 'medium' | 'high',
): Array<{
  bucket: string;
  metric: string;
  value: number;
  expected: number;
  z: number;
  direction: 'spike' | 'dip';
}> {
  const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
  const anomalies: Array<{
    bucket: string;
    metric: string;
    value: number;
    expected: number;
    z: number;
    direction: 'spike' | 'dip';
  }> = [];

  // Need at least 8 data points for rolling baseline (7 for baseline + 1 current)
  if (series.length < 8) return anomalies;

  for (let i = 7; i < series.length; i++) {
    const current = series[i];
    const baseline = series.slice(i - 7, i);
    const baselineValues = baseline.map(b => b.value);

    const median = calculateMedian(baselineValues);
    const mad = calculateMAD(baselineValues);
    const stdDev = mad;

    if (stdDev === 0) continue;

    const zScore = Math.abs(current.value - median) / stdDev;

    if (zScore >= threshold) {
      const direction = current.value > median ? 'spike' : 'dip';
      anomalies.push({
        bucket: current.bucket,
        metric: 'visits',
        value: current.value,
        expected: median,
        z: zScore,
        direction,
      });
    }
  }

  return anomalies;
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string | null> {
  if (websiteIdInput) return websiteIdInput;
  const active = getActiveWebsiteId();
  if (active) return active;
  if (DEFAULT_WEBSITE_ID) return DEFAULT_WEBSITE_ID;

  const first = await prisma.client.website.findFirst({
    where: { deletedAt: null },
    select: { id: true },
  });
  if (first?.id) {
    setActiveWebsiteId(first.id);
    return first.id;
  }
  return null;
}

export const getDetectTimeseriesAnomaliesTool = {
  name: 'get-detect-timeseries-anomalies',
  description:
    'Detect anomalies in time-series data for visits, pageviews, bounce rate, and visit duration using robust statistical methods',
  inputSchema,

  execute: async (rawParams: unknown) => {
    // log('[start]', { rawParams });
    // console.log('[anomaly][timeseries] start', { rawParams });
    const params = inputSchema.parse(rawParams as Input);
    // log('[params]', params);
    // console.log('[anomaly][timeseries] parsed params', params);
    const websiteId = await resolveWebsiteId(params.websiteId);
    // log('[websiteId]', websiteId);
    // console.log('[anomaly][timeseries] resolved websiteId', websiteId);
    if (!websiteId) {
      throw new Error('No website ID available');
    }

    const dbType = getDatabaseType();
    // log('[db]', { hasClickhouseUrl: !!process.env.CLICKHOUSE_URL, dbType });
    // console.log('[anomaly][timeseries] db', { hasClickhouseUrl: !!process.env.CLICKHOUSE_URL, dbType });

    const queries = {
      [CLICKHOUSE]: async () => {
        const { createClient } = await import('@clickhouse/client');
        const client = createClient({ url: process.env.CLICKHOUSE_URL! });

        let query: string;
        const qparams = { websiteId, date_from: params.date_from, date_to: params.date_to };

        switch (params.metric) {
          case 'visits':
            query = `
              WITH
                ${getDateTruncSQL('created_at', params.interval, dbType)} AS d
              SELECT
                d AS bucket,
                uniq(visit_id) AS value
              FROM website_event
              WHERE website_id = {websiteId:UUID}
                AND ${getDateRangeSQL(dbType)}
              GROUP BY bucket
              ORDER BY bucket`;
            break;

          case 'pageviews':
            query = `
              WITH
                ${getDateTruncSQL('created_at', params.interval, dbType)} AS d
              SELECT
                d AS bucket,
                countIf(event_type = 1) AS value
              FROM website_event
              WHERE website_id = {websiteId:UUID}
                AND ${getDateRangeSQL(dbType)}
              GROUP BY bucket
              ORDER BY bucket`;
            break;

          case 'bounce_rate':
            query = `
              WITH
                ${getDateTruncSQL('created_at', params.interval, dbType)} AS d
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
                  AND ${getDateRangeSQL(dbType)}
                GROUP BY visit_id, d
              )
              GROUP BY bucket
              ORDER BY bucket`;
            break;

          case 'visit_duration':
            query = `
              WITH
                ${getDateTruncSQL('created_at', params.interval, dbType)} AS d
              SELECT
                d AS bucket,
                avg(duration_seconds) AS value
              FROM (
                SELECT
                  visit_id, d,
                  max(created_at) - min(created_at) AS duration_seconds
                FROM website_event
                WHERE website_id = {websiteId:UUID}
                  AND ${getDateRangeSQL(dbType)}
                GROUP BY visit_id, d
              )
              GROUP BY bucket
              ORDER BY bucket`;
            break;

          default:
            throw new Error(`Unsupported metric: ${params.metric}`);
        }

        // log('[clickhouse][exec]', { metric: params.metric, interval: params.interval, qparams, query });
        // console.log('[anomaly][timeseries][clickhouse][exec]', { metric: params.metric, interval: params.interval, qparams, query });
        const result = await client.query({
          query,
          query_params: qparams,
        } as any);
        const raw: any = await result.json();
        const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        // log('[clickhouse][rows]', { length: rows.length, sample: rows.slice(0, 3) });
        // console.log('[anomaly][timeseries][clickhouse][rows]', { length: rows.length, sample: rows.slice(0, 3) });
        return rows.map((row: any) => ({ bucket: row.bucket, value: Number(row.value) || 0 }));
      },

      [PRISMA]: async () => {
        const dateTrunc = getDateTruncSQL('created_at', params.interval, dbType);
        const dateRange = getDateRangeSQL(dbType);
        const websiteIdParam = dbType === POSTGRESQL ? '$1::uuid' : '$1';

        let query: string;

        switch (params.metric) {
          case 'visits':
            query = `
              SELECT 
                ${dateTrunc} AS bucket,
                COUNT(DISTINCT visit_id) AS value
              FROM website_event 
              WHERE website_id = ${websiteIdParam} 
                AND ${dateRange}
              GROUP BY ${dateTrunc}
              ORDER BY ${dateTrunc}`;
            break;

          case 'pageviews':
            query = `
              SELECT 
                ${dateTrunc} AS bucket,
                COUNT(CASE WHEN event_type = 1 THEN 1 END) AS value
              FROM website_event 
              WHERE website_id = ${websiteIdParam} 
                AND ${dateRange}
              GROUP BY ${dateTrunc}
              ORDER BY ${dateTrunc}`;
            break;

          case 'bounce_rate':
            query = `
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
            break;

          case 'visit_duration':
            query = `
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
            break;

          default:
            throw new Error(`Unsupported metric: ${params.metric}`);
        }

        // log('[prisma][exec]', { metric: params.metric, interval: params.interval, websiteId, date_from: params.date_from, date_to: params.date_to, query });
        // console.log('[anomaly][timeseries][prisma][exec]', { metric: params.metric, interval: params.interval, websiteId, date_from: params.date_from, date_to: params.date_to, query });
        const result = await prisma.client.$queryRawUnsafe(
          query,
          websiteId,
          params.date_from,
          params.date_to,
        );
        const rows = Array.isArray(result) ? (result as any[]) : [];
        // log('[prisma][rows]', { length: rows.length, sample: rows.slice(0, 3) });
        // console.log('[anomaly][timeseries][prisma][rows]', { length: rows.length, sample: rows.slice(0, 3) });
        return rows.map((row: any) => ({
          bucket: row.bucket,
          value: Number(row.value) || 0,
        }));
      },
    };

    const series = await runQuery(queries);
    const seriesRows = Array.isArray(series) ? series : [];
    // log('[series]', { length: seriesRows.length, sample: seriesRows.slice(0, 5) });
    // console.log('[anomaly][timeseries][series]', { length: seriesRows.length, sample: seriesRows.slice(0, 5) });

    if (!seriesRows || seriesRows.length === 0) {
      // log('[no-data] No data available for specified parameters');
      // console.log('[anomaly][timeseries][no-data] No data available for specified parameters');
      return {
        anomalies: [],
        series: [],
        message: 'No data available for the specified parameters',
      };
    }

    const anomalies = detectAnomalies(seriesRows, params.sensitivity);
    // log('[anomalies]', { length: anomalies.length, sample: anomalies.slice(0, 5) });
    // console.log('[anomaly][timeseries][anomalies]', { length: anomalies.length, sample: anomalies.slice(0, 5) });

    anomalies.forEach(anomaly => {
      anomaly.metric = params.metric;
    });

    return {
      anomalies,
      series: seriesRows.map(item => ({ bucket: item.bucket, value: item.value })),
    };
  },
};

export type GetDetectTimeseriesAnomaliesTool = typeof getDetectTimeseriesAnomaliesTool;
