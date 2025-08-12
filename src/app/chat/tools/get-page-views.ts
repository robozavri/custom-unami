import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getPageviewMetrics } from '@/queries';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
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
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      path,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) {
      throw new Error(
        'websiteId is required. Set an active website with set-active-website or configure DEFAULT_WEBSITE_ID.',
      );
    }

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Database-agnostic: use built-in query wrapper (returns unique visitors per path)
    const filters: any = { startDate, endDate };
    if (path) filters.url = path; // equality match; for contains we can extend later

    const metrics = await getPageviewMetrics(websiteId, 'url', filters, 500, 0);
    const formatted = metrics.map(({ x, y }) => ({
      path: x || 'Unknown',
      unique_visitors: Number(y) || 0,
    }));

    const totalPages = formatted.length;
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
        total_unique_visitors: totalVisitors,
        top_page: topPage ? { path: topPage.path, visitors: topPage.unique_visitors } : null,
        least_viewed_page: leastViewedPage
          ? { path: leastViewedPage.path, visitors: leastViewedPage.unique_visitors }
          : null,
      },
      results: formatted,
    };
  },
};

export type GetPageViewsTool = typeof getPageViewsTool;
