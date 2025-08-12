import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getRetentionMetrics } from '@/queries';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import { DEFAULT_WEBSITE_ID } from '../config';

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
    if (!websiteId) throw new Error('websiteId is required.');

    const { startDate, endDate } = computeRange(date_from, date_to);

    const filters: any = { startDate, endDate };
    if (event_name) {
      // Map event_name to eventType if it's a known event
      if (event_name === 'page_view') filters.eventType = 1;
      else if (event_name === 'custom_event') filters.eventType = 2;
      // For other event names, we'll use the default (pageview)
    }

    const rows = await getRetentionMetrics(websiteId, filters, period, date_range);

    const formatted = rows.map(r => ({
      date: r.date,
      active_users: r.active_users,
      retention_rate: r.retention_rate,
    }));

    const totalPeriods = formatted.length;
    const totalActiveUsers = formatted.reduce((s, it) => s + it.active_users, 0);
    const averageRetentionRate =
      totalPeriods > 0 ? formatted.reduce((s, it) => s + it.retention_rate, 0) / totalPeriods : 0;

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
