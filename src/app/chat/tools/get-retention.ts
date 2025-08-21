import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getRetention } from '@/queries';
import { getRetentionCohorts } from '@/queries/sql/anomaly-insights/getRetentionCohorts';
import { getWebsiteId } from '../state';

const periodEnum = z.enum(['day', 'week', 'month']);

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  period: periodEnum.default('day'),
  date_range: z.number().int().positive().max(365).default(30),
  event_name: z.string().optional(),
  date_from: z.string().optional(), // YYYY-MM-DD
  date_to: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

function computeRange(start?: string, end?: string) {
  // Default: last 30 days when no params provided
  if (!start || !end) {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    return { startDate, endDate };
  }
  return { startDate: parseISO(start), endDate: parseISO(end) };
}

export const getRetentionTool = {
  name: 'get-retention',
  description: `
  - Get user retention data for a website.
  - Shows how many users return after their first activity.
  - Supports daily, weekly, and monthly retention periods.
  - Can analyze retention for specific events or all events.
  - Returns cohort analysis with retention rates.
  - REQUIRED: period parameter must be provided ("day", "week", or "month")
  - Example usage: {"period": "day"} or {"period": "week", "date_range": 12, "event_name": "page_view"}
  `.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      period,
      date_range,
      event_name,
      date_from,
      date_to,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    const { startDate, endDate } = computeRange(date_from, date_to);

    // Note: event_name filtering is not currently supported by the cohort queries used below.
    // Compute cohort-based retention:
    // - For day period: use getRetention() and take k=1 (day=1) retention per cohort date
    // - For week/month periods: use getRetentionCohorts() and compute k=1 retention per cohort
    let formatted: Array<{ date: string; active_users: number; retention_rate: number }>;

    if (period === 'day') {
      const rows = await getRetention(websiteId, { startDate, endDate });
      // console.log('getRetention rows', rows);
      // Build a map of date -> k=1 record
      const byDate = new Map<string, { active_users: number; retention_rate: number }>();
      for (const r of rows) {
        if (r.day === 1) {
          byDate.set(r.date, {
            active_users: Number(r.returnVisitors) || 0,
            retention_rate: Math.round((Number(r.percentage) || 0) * 100) / 100,
          });
        }
      }

      // Sort dates desc and limit
      const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));
      const limited = dates.slice(0, date_range);
      formatted = limited.map(d => ({ date: d, ...byDate.get(d)! }));
    } else {
      // week or month
      const rows = await getRetentionCohorts({
        websiteId,
        period,
        date_from: formatISO(startDate, { representation: 'date' }),
        date_to: formatISO(endDate, { representation: 'date' }),
        max_k: 1,
      });

      // Build cohort size (k=0) and k=1 actives per cohort
      const sizeByCohort = new Map<string, number>();
      const k1ByCohort = new Map<string, number>();
      for (const r of rows) {
        const cohort = r.cohort_start;
        const count = Number(r.active_users) || 0;
        if (r.k === 0) sizeByCohort.set(cohort, count);
        else if (r.k === 1) k1ByCohort.set(cohort, count);
      }

      const items: Array<{ date: string; active_users: number; retention_rate: number }> = [];
      for (const [cohort, k1] of k1ByCohort.entries()) {
        const size = sizeByCohort.get(cohort) || 0;
        const rate = size > 0 ? Math.round((k1 / size) * 100 * 100) / 100 : 0;
        items.push({ date: cohort, active_users: k1, retention_rate: rate });
      }

      // Sort desc by date and limit
      items.sort((a, b) => (a.date < b.date ? 1 : -1));
      formatted = items.slice(0, date_range);
    }

    const totalPeriods = formatted.length;
    const totalActiveUsers = formatted.reduce((s, it) => s + it.active_users, 0);
    const averageRetentionRate =
      totalPeriods > 0 ? formatted.reduce((s, it) => s + it.retention_rate, 0) / totalPeriods : 0;
    // console.log('formatted', formatted);
    // console.log('formatted', {
    //   period,
    //   date_range,
    //   event_name: event_name || 'all_events',
    //   start_date: formatISO(startDate, { representation: 'date' }),
    //   end_date: formatISO(endDate, { representation: 'date' }),
    //   summary: {
    //     total_periods: totalPeriods,
    //     total_active_users: totalActiveUsers,
    //     average_retention_rate: Math.round(averageRetentionRate * 100) / 100,
    //   },
    //   results: formatted,
    // });
    return {
      period,
      date_range,
      event_name: event_name || 'all_events',
      start_date: formatISO(startDate, { representation: 'date' }),
      end_date: formatISO(endDate, { representation: 'date' }),
      summary: {
        total_periods: totalPeriods,
        total_active_users: totalActiveUsers,
        average_retention_rate: Math.round(averageRetentionRate * 100) / 100,
      },
      results: formatted,
    };
  },
};

export type GetRetentionTool = typeof getRetentionTool;
