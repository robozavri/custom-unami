import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getDetailedPageviewMetrics } from '@/queries';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import { DEFAULT_WEBSITE_ID } from '../config';

// Debug function that can be toggled
const DEBUG = false; // Force enable debug for troubleshooting
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`🔍 [DEBUG] ${message}`, data);
  }
};

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
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
  throw new Error(
    'No website ID found. Please provide a websiteId or ensure there are websites in the database.',
  );
}

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  days: z.number().int().positive().default(7),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  path: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getDetailedPageViewsTool = {
  name: 'get-detailed-page-views',
  description:
    'Get detailed page view metrics: bounce rate, session duration, engagement per path with optional path filter.',
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    // DEBUG: Log raw input parameters
    // debugLog('Raw params received', rawParams);

    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      path,
    } = paramsSchema.parse(rawParams as Params);

    // DEBUG: Log parsed parameters
    // debugLog('Parsed params', {
    //   websiteId: websiteIdInput,
    //   days,
    //   date_from,
    //   date_to,
    //   path,
    // });

    const websiteId = await resolveWebsiteId(websiteIdInput);

    // DEBUG: Log resolved website ID
    // debugLog('Resolved websiteId', websiteId);

    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // DEBUG: Log date range calculations
    // debugLog('Date range', {
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    //   days,
    // });

    const filters: any = { startDate, endDate };
    if (path) filters.url = path;

    // DEBUG: Log filters being applied
    // debugLog('Filters applied', filters);

    // DEBUG: Log the query parameters being sent
    // debugLog('About to call getDetailedPageviewMetrics with:', { websiteId, filters });

    let rows;
    try {
      // DEBUG: Log the exact filter structure being sent
      // debugLog('Filter structure details:', {
      //   startDate: filters.startDate,
      //   endDate: filters.endDate,
      //   startDateType: typeof filters.startDate,
      //   endDateType: typeof filters.endDate,
      //   startDateISO: filters.startDate?.toISOString(),
      //   endDateISO: filters.endDate?.toISOString(),
      //   path: filters.url,
      // });

      // DEBUG: Check if we need to restart the server for changes to take effect
      // debugLog('Note: If you just fixed the SQL query, you may need to restart the server');

      rows = await getDetailedPageviewMetrics(websiteId, filters);

      // DEBUG: Log raw query results
      // debugLog('Raw rows from query', rows);
      // debugLog('Number of rows returned', rows ? rows.length : 'null/undefined');

      // if (!rows || rows.length === 0) {
      //   debugLog('No rows returned - this might indicate no data for the date range or website');
      //   debugLog(
      //     'Possible causes: 1) No data in date range, 2) Website has no events, 3) Database query issue',
      //   );
      // }
    } catch (error) {
      // debugLog('Error calling getDetailedPageviewMetrics', error);
      debugLog('Error details:', {
        name: (error as any).name,
        message: (error as any).message,
        code: (error as any).code,
        meta: (error as any).meta,
      });
      throw error;
    }

    const formatted = rows.map((r: any) => {
      const totalViews = Number(r.total_views) || 0;
      const uniqueVisitors = Number(r.unique_visitors) || 0;
      const totalSessions = Number(r.total_sessions) || 0;
      const bounceSessions = Number(r.bounce_sessions) || 0;
      const avgViewsPerVisitor = uniqueVisitors > 0 ? totalViews / uniqueVisitors : 0;
      const avgViewsPerSession = totalSessions > 0 ? totalViews / totalSessions : 0;
      const avgSessionDuration = Number(r.avg_session_duration_seconds) || 0;
      const bounceRate = totalSessions > 0 ? (bounceSessions * 100) / totalSessions : 0;
      return {
        path: r.path || 'Unknown',
        total_views: totalViews,
        unique_visitors: uniqueVisitors,
        total_sessions: totalSessions,
        avg_views_per_visitor: Math.round(avgViewsPerVisitor * 100) / 100,
        avg_views_per_session: Math.round(avgViewsPerSession * 100) / 100,
        avg_session_duration_seconds: Math.round(avgSessionDuration * 100) / 100,
        bounce_sessions: bounceSessions,
        bounce_rate_percent: Math.round(bounceRate * 100) / 100,
      };
    });

    // DEBUG: Log formatted data
    // debugLog('Formatted rows', formatted);

    const totalPages = formatted.length;
    const totalViews = formatted.reduce((s, it) => s + it.total_views, 0);
    const totalVisitors = formatted.reduce((s, it) => s + it.unique_visitors, 0);
    const totalSessions = formatted.reduce((s, it) => s + it.total_sessions, 0);
    const totalBounceSessions = formatted.reduce((s, it) => s + it.bounce_sessions, 0);
    const averageViewsPerPage = totalPages > 0 ? totalViews / totalPages : 0;
    const averageViewsPerVisitor = totalVisitors > 0 ? totalViews / totalVisitors : 0;
    const averageViewsPerSession = totalSessions > 0 ? totalViews / totalSessions : 0;
    const overallBounceRate = totalSessions > 0 ? (totalBounceSessions * 100) / totalSessions : 0;

    const topPage = formatted[0] || null;
    const leastViewedPage = formatted.length > 0 ? formatted[formatted.length - 1] : null;
    const bestEngagementPage = formatted.reduce(
      (best: any, cur: any) =>
        (cur.avg_views_per_visitor || 0) > (best?.avg_views_per_visitor || 0) ? cur : best,
      null as any,
    );
    const worstBounceRatePage = formatted.reduce(
      (worst: any, cur: any) =>
        (cur.bounce_rate_percent || 0) > (worst?.bounce_rate_percent || 0) ? cur : worst,
      null as any,
    );

    const result = {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: path || 'all_pages',
      summary: {
        total_pages: totalPages,
        total_views: totalViews,
        total_unique_visitors: totalVisitors,
        total_sessions: totalSessions,
        total_bounce_sessions: totalBounceSessions,
        average_views_per_page: Math.round(averageViewsPerPage * 100) / 100,
        average_views_per_visitor: Math.round(averageViewsPerVisitor * 100) / 100,
        average_views_per_session: Math.round(averageViewsPerSession * 100) / 100,
        overall_bounce_rate_percent: Math.round(overallBounceRate * 100) / 100,
        top_page: topPage,
        least_viewed_page: leastViewedPage,
        best_engagement_page: bestEngagementPage,
        worst_bounce_rate_page: worstBounceRatePage,
      },
      results: formatted,
    };

    // DEBUG: Log final result
    // debugLog('Final result', result);

    return result;
  },
};

export type GetDetailedPageViewsTool = typeof getDetailedPageViewsTool;
