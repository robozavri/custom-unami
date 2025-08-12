import { z } from 'zod';
import { parseISO, subDays, formatISO } from 'date-fns';
import { getUserBehaviorMetrics } from '@/queries';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import { DEFAULT_WEBSITE_ID } from '../config';

const periodEnum = z.enum([
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_180_days',
  'last_365_days',
]);

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  period: periodEnum.optional(),
  start_date: z.string().optional(), // YYYY-MM-DD
  end_date: z.string().optional(),
  filter: z.string().optional(), // path substring
  limit: z.number().int().positive().max(1000).default(50),
  offset: z.number().int().nonnegative().default(0),
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

function computeRange(period?: Params['period'], start?: string, end?: string) {
  // Default: last 14 days when no params provided
  if (!period && (!start || !end)) {
    const endDate = new Date();
    const startDate = subDays(endDate, 14);
    return { startDate, endDate };
  }

  if (period) {
    const today = new Date();
    const endDate = today;
    let startDate = subDays(endDate, 30); // default
    switch (period) {
      case 'last_7_days':
        startDate = subDays(endDate, 7);
        break;
      case 'last_30_days':
        startDate = subDays(endDate, 30);
        break;
      case 'last_90_days':
        startDate = subDays(endDate, 90);
        break;
      case 'last_180_days':
        startDate = subDays(endDate, 180);
        break;
      case 'last_365_days':
        startDate = subDays(endDate, 365);
        break;
    }
    return { startDate, endDate };
  }

  return { startDate: parseISO(start as string), endDate: parseISO(end as string) };
}

export const getUserBehaviorTool = {
  name: 'get-user-behavior',
  description: `
  - Get user behavior analytics including session duration, bounce sessions, and engagement metrics per user (distinct_id).
  - Supports predefined periods (last_7_days, last_30_days, etc.) or custom date ranges (YYYY-MM-DD).
  - Supports path-based filtering via 'filter' (substring of url_path).
  - Returns per-user rows and a summary.
  `.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      period,
      start_date,
      end_date,
      filter,
      limit,
      offset,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) throw new Error('websiteId is required.');

    const { startDate, endDate } = computeRange(period, start_date, end_date);

    const filters: any = { startDate, endDate };
    if (filter) filters.url = filter;

    // eslint-disable-next-line no-console
    console.log('get-user-behavior: calling getUserBehaviorMetrics with:', {
      websiteId,
      filters,
      limit,
      offset,
    });

    let rows;
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000),
      );

      const queryPromise = getUserBehaviorMetrics(websiteId, filters, limit, offset);
      rows = await Promise.race([queryPromise, timeoutPromise]);

      // eslint-disable-next-line no-console
      console.log('get-user-behavior: getUserBehaviorMetrics returned successfully:', {
        rowCount: rows?.length || 0,
        sampleRow: rows?.[0] || null,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('get-user-behavior: getUserBehaviorMetrics failed:', error);
      throw new Error(
        `Failed to get user behavior data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const formatted = rows.map(r => {
      const totalSessions = Number(r.total_sessions) || 0;
      const totalPageViews = Number(r.total_page_views) || 0;
      const firstView = new Date(r.first_view);
      const lastView = new Date(r.last_view);
      const sessionDurationSeconds = (lastView.getTime() - firstView.getTime()) / 1000;
      const avgViewsPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

      return {
        user_id: r.user_id,
        total_sessions: totalSessions,
        total_page_views: totalPageViews,
        average_session_duration_seconds: Math.round(sessionDurationSeconds * 100) / 100,
        avg_page_views_per_session: Math.round(avgViewsPerSession * 100) / 100,
        avg_session_duration_minutes: Math.round((sessionDurationSeconds / 60) * 100) / 100,
        first_view: firstView.toISOString(),
        last_view: lastView.toISOString(),
      };
    });

    // eslint-disable-next-line no-console
    console.log('get-user-behavior: formatted results:', {
      formattedCount: formatted.length,
      sampleFormatted: formatted[0] || null,
    });

    const totalUsers = formatted.length;
    const totalSessions = formatted.reduce((s, it) => s + it.total_sessions, 0);
    const totalPageViews = formatted.reduce((s, it) => s + it.total_page_views, 0);

    const averageSessionsPerUser = totalUsers > 0 ? totalSessions / totalUsers : 0;
    const averageSessionDuration =
      totalUsers > 0
        ? formatted.reduce((s, it) => s + it.average_session_duration_seconds, 0) / totalUsers
        : 0;
    const averagePageViewsPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

    // simplest best/worst selection
    const mostEngagedUser = formatted.reduce(
      (best, cur) =>
        best == null || cur.average_session_duration_seconds > best.average_session_duration_seconds
          ? cur
          : best,
      null as any,
    );

    const leastEngagedUser = formatted.reduce(
      (worst, cur) =>
        worst == null ||
        cur.average_session_duration_seconds < worst.average_session_duration_seconds
          ? cur
          : worst,
      null as any,
    );

    const mostActiveUser = formatted.reduce(
      (best, cur) => (best == null || cur.total_sessions > best.total_sessions ? cur : best),
      null as any,
    );

    return {
      period: period ?? null,
      start_date: formatISO(startDate, { representation: 'date' }),
      end_date: formatISO(endDate, { representation: 'date' }),
      filter: filter ?? 'all_users',
      limit,
      offset,
      summary: {
        total_users: totalUsers,
        total_sessions: totalSessions,
        total_page_views: totalPageViews,
        average_sessions_per_user: Math.round(averageSessionsPerUser * 100) / 100,
        average_session_duration_seconds: Math.round(averageSessionDuration * 100) / 100,
        average_session_duration_minutes: Math.round((averageSessionDuration / 60) * 100) / 100,
        average_page_views_per_session: Math.round(averagePageViewsPerSession * 100) / 100,
        most_engaged_user: mostEngagedUser,
        least_engaged_user: leastEngagedUser,
        most_active_user: mostActiveUser,
      },
      results: formatted,
    };
  },
};

export type GetUserBehaviorTool = typeof getUserBehaviorTool;
