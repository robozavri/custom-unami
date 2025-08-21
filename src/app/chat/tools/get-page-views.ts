import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getPageViewsWithTotals } from '@/queries';
import { getWebsiteId } from '../state';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  days: z.number().int().positive().default(7),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  path: z.string().optional(),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getPageViewsTool = {
  name: 'get-page-views',
  description: `
- Get page view statistics per path: total views and unique visitors.
- Defaults to last 7 days if no range is provided.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to   (YYYY-MM-DD, optional)
  - path (string, optional; substring match on URL path)
  - timezone (string, optional; affects grouping in some backends)
- Returns summary plus array of { path, total_views, unique_visitors, avg_views_per_visitor }.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    try {
      const {
        websiteId: websiteIdInput,
        days,
        date_from,
        date_to,
        path,
      } = paramsSchema.parse(rawParams as Params);

      const websiteId = await resolveWebsiteId(websiteIdInput);
      // websiteId is guaranteed to be a valid string from getWebsiteId

      // Determine date range
      const today = new Date();
      const endDate = date_to ? parseISO(date_to) : today;
      const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

      // Use the new database-agnostic function to get both total views and unique visitors
      const filters: any = { startDate, endDate };
      if (path) filters.url = path; // substring match using LIKE operator

      const metrics = await getPageViewsWithTotals(websiteId, filters);
      const formatted = metrics.map(({ path: pagePath, total_views, unique_visitors }) => ({
        path: pagePath || 'Unknown',
        total_views: Number(total_views) || 0,
        unique_visitors: Number(unique_visitors) || 0,
        avg_views_per_visitor:
          Number(unique_visitors) > 0
            ? Math.round((Number(total_views) / Number(unique_visitors)) * 100) / 100
            : 0,
      }));

      const totalPages = formatted.length;
      const totalViews = formatted.reduce((sum, it) => sum + it.total_views, 0);
      const totalVisitors = formatted.reduce((sum, it) => sum + it.unique_visitors, 0);

      const topPage = formatted[0] || null;
      const leastViewedPage = formatted.length > 0 ? formatted[formatted.length - 1] : null;

      return {
        days,
        start_date: toDateOnly(startDate),
        end_date: toDateOnly(endDate),
        filter: path || 'all_pages',
        summary: {
          total_pages: totalPages,
          total_views: totalViews,
          total_unique_visitors: totalVisitors,
          top_page: topPage
            ? {
                path: topPage.path,
                views: topPage.total_views,
                visitors: topPage.unique_visitors,
              }
            : null,
          least_viewed_page: leastViewedPage
            ? {
                path: leastViewedPage.path,
                views: leastViewedPage.total_views,
                visitors: leastViewedPage.unique_visitors,
              }
            : null,
        },
        results: formatted,
      };
    } catch (error) {
      // Return error information that will show up in the response
      return {
        error: true,
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        error_stack: error instanceof Error ? error.stack : undefined,
      };
    }
  },
};

export type GetPageViewsTool = typeof getPageViewsTool;
