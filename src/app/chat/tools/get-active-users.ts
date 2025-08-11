import { z } from 'zod';
import { getSessionStats } from '@/queries';
import { parseISO, subDays, startOfWeek, formatISO } from 'date-fns';
import { DEFAULT_WEBSITE_ID } from '../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import prisma from '@/lib/prisma';

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  interval: z.enum(['daily', 'weekly']).default('daily'),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  timezone: z.string().optional(),
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

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

function getRange(interval: 'daily' | 'weekly', date_from?: string, date_to?: string) {
  const end = date_to ? parseISO(date_to) : new Date();

  if (interval === 'weekly') {
    // default last 12 weeks (84 days)
    const start = date_from ? parseISO(date_from) : subDays(end, 83);
    return { startDate: start, endDate: end };
  }

  // default last 30 days
  const start = date_from ? parseISO(date_from) : subDays(end, 29);
  return { startDate: start, endDate: end };
}

export const getActiveUsersTool = {
  name: 'get-active-users',
  description: `
- Get daily or weekly active users count for a website.
- Returns: [{ date, active_users }]
- Defaults: interval=daily; daily=last 30 days; weekly=last 12 weeks.
- Params:
  - websiteId (string). If omitted, uses active website or DEFAULT_WEBSITE_ID.
  - interval ('daily'|'weekly', default 'daily')
  - date_from (YYYY-MM-DD)
  - date_to   (YYYY-MM-DD)
  - timezone  (default 'utc')
- Example: {"websiteId":"<id>","interval":"weekly","date_from":"2024-01-01","date_to":"2024-01-31"}
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      interval,
      date_from,
      date_to,
      timezone,
    } = paramsSchema.parse(rawParams as Params);
    const resolvedWebsiteId = await resolveWebsiteId(websiteIdInput);

    if (!resolvedWebsiteId) {
      throw new Error(
        'websiteId is required. Set an active website with set-active-website or configure DEFAULT_WEBSITE_ID.',
      );
    }
    const { startDate, endDate } = getRange(interval, date_from, date_to);

    // Fetch distinct session counts per day (DB-agnostic via queries layer)
    const daily = await getSessionStats(resolvedWebsiteId, {
      startDate,
      endDate,
      unit: 'day',
      timezone: timezone || 'utc',
    }); // -> [{ x: 'YYYY-MM-DD ...', y: number }]

    if (interval === 'daily') {
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

    // Weekly: group daily counts by ISO week start (Mon). Note: sums daily uniques (approx WAU).
    const weeklyMap = new Map<string, number>();
    for (const { x, y } of daily) {
      const weekKey = toDateOnly(startOfWeek(new Date(x), { weekStartsOn: 1 }));
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + Number(y));
    }

    const weekly = Array.from(weeklyMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, value]) => ({ date, active_users: value }));

    return {
      interval,
      date_from: toDateOnly(startDate),
      date_to: toDateOnly(endDate),
      data: weekly,
    };
  },
};

export type GetActiveUsersTool = typeof getActiveUsersTool;
