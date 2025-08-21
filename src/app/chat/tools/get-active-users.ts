import { z } from 'zod';
import { getSessionStats } from '@/queries';
import {
  parseISO,
  subDays,
  startOfWeek,
  formatISO,
  startOfMonth,
  startOfYear,
  addMonths,
} from 'date-fns';
import { getWebsiteId } from '../state';
import debug from 'debug';

const log = debug('umami:getActiveUsers');

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

function getRange(interval: 'daily' | 'weekly' | 'monthly', date_from?: string, date_to?: string) {
  const end = date_to ? parseISO(date_to) : new Date();

  if (interval === 'weekly') {
    // default last 12 weeks (84 days)
    const start = date_from ? parseISO(date_from) : subDays(end, 83);
    return { startDate: start, endDate: end };
  }

  if (interval === 'monthly') {
    // Default: current year months (Jan 1 → start of next month)
    const start = date_from ? startOfMonth(parseISO(date_from)) : startOfYear(end);
    const endAdj = date_to
      ? addMonths(startOfMonth(parseISO(date_to)), 1)
      : addMonths(startOfMonth(end), 1);
    return { startDate: start, endDate: endAdj };
  }

  // default last 30 days
  const start = date_from ? parseISO(date_from) : subDays(end, 29);
  return { startDate: start, endDate: end };
}

export const getActiveUsersTool = {
  name: 'get-active-users',
  description: `
- Get daily, weekly, or monthly active users count for a website.
- Returns: [{ date, active_users }]; weekly/monthly are exact distinct users per bucket.
- Defaults: interval=daily; daily=last 30 days; weekly=last 12 weeks; monthly=last 12 months.
- Params:
  - websiteId (string). If omitted, uses active website or DEFAULT_WEBSITE_ID.
  - interval ('daily'|'weekly'|'monthly', default 'daily')
  - date_from (YYYY-MM-DD)
  - date_to   (YYYY-MM-DD)
  - timezone  (default 'utc')
- Example: {"websiteId":"<id>","interval":"weekly","date_from":"2024-01-01","date_to":"2024-01-31"}
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    log('[start]', { rawParams });
    // eslint-disable-next-line no-console
    console.log(
      '[get-active-users] received params:',
      (() => {
        try {
          return JSON.stringify(rawParams);
        } catch {
          return rawParams;
        }
      })(),
    );
    const {
      websiteId: websiteIdInput,
      interval,
      date_from,
      date_to,
      timezone,
    } = paramsSchema.parse(rawParams as Params);
    const resolvedWebsiteId = await resolveWebsiteId(websiteIdInput);

    // resolvedWebsiteId is guaranteed to be a valid string from getWebsiteId
    const { startDate, endDate } = getRange(interval, date_from, date_to);
    // eslint-disable-next-line no-console
    console.log('[get-active-users] resolved args:', {
      websiteId: resolvedWebsiteId,
      interval,
      date_from: date_from || toDateOnly(startDate),
      date_to: date_to || toDateOnly(endDate),
      timezone: timezone || 'utc',
      startDate: toDateOnly(startDate),
      endDate: toDateOnly(endDate),
    });

    if (interval === 'daily') {
      // Distinct sessions per day
      // eslint-disable-next-line no-console
      console.log('[get-active-users] query (daily):', {
        unit: 'day',
        startDate: toDateOnly(startDate),
        endDate: toDateOnly(endDate),
      });
      const daily = await getSessionStats(resolvedWebsiteId, {
        startDate,
        endDate,
        unit: 'day',
        timezone: timezone || 'utc',
      });
      // eslint-disable-next-line no-console
      console.log('[get-active-users] db rows (daily):', {
        count: Array.isArray(daily) ? daily.length : null,
        sample: Array.isArray(daily) ? daily.slice(0, 5) : daily,
      });
      return {
        interval,
        date_from: toDateOnly(startDate),
        date_to: toDateOnly(endDate),
        data: daily.map(({ x, y }) => ({
          date: String(x).slice(0, 10),
          active_users: Number(y),
        })),
      };
    }

    if (interval === 'weekly') {
      // Exact WAU: distinct sessions per week bucket
      // eslint-disable-next-line no-console
      console.log('[get-active-users] query (weekly):', {
        unit: 'week',
        startDate: toDateOnly(startDate),
        endDate: toDateOnly(endDate),
      });
      const weekly = await getSessionStats(resolvedWebsiteId, {
        startDate,
        endDate,
        unit: 'week',
        timezone: timezone || 'utc',
      });
      // eslint-disable-next-line no-console
      console.log('[get-active-users] db rows (weekly):', {
        count: Array.isArray(weekly) ? weekly.length : null,
        sample: Array.isArray(weekly) ? weekly.slice(0, 5) : weekly,
      });
      return {
        interval,
        date_from: toDateOnly(startDate),
        date_to: toDateOnly(endDate),
        data: weekly.map(({ x, y }) => ({
          date: toDateOnly(startOfWeek(new Date(String(x)), { weekStartsOn: 1 })),
          active_users: Number(y),
        })),
      };
    }

    // Monthly: exact MAU: distinct sessions per month bucket
    // eslint-disable-next-line no-console
    console.log('[get-active-users] query (monthly):', {
      unit: 'month',
      startDate: toDateOnly(startDate),
      endDate: toDateOnly(endDate),
    });
    const monthly = await getSessionStats(resolvedWebsiteId, {
      startDate,
      endDate,
      unit: 'month',
      timezone: timezone || 'utc',
    });
    // eslint-disable-next-line no-console
    console.log('[get-active-users] db rows (monthly):', {
      count: Array.isArray(monthly) ? monthly.length : null,
      sample: Array.isArray(monthly) ? monthly.slice(0, 5) : monthly,
    });
    return {
      interval,
      date_from: toDateOnly(startDate),
      date_to: toDateOnly(endDate),
      data: monthly.map(({ x, y }) => ({
        date: toDateOnly(startOfMonth(new Date(String(x)))),
        active_users: Number(y),
      })),
    };
  },
};

export type GetActiveUsersTool = typeof getActiveUsersTool;
