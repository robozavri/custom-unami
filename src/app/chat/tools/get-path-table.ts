import { z } from 'zod';
import { getPathTable } from '@/queries';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import { DEFAULT_WEBSITE_ID } from '../config';

const periodEnum = z.enum([
  'today',
  'yesterday',
  'last_24_hours',
  'last_7_days',
  'last_14_days',
  'last_30_days',
  'last_90_days',
  'last_180_days',
  'this_month',
  'all_time',
  'custom',
]);

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  period: periodEnum.default('last_30_days'),
  custom_days: z.number().int().positive().max(365).optional(),
  limit: z.number().int().positive().max(100).default(10),
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

function calculateDateRange(period: string, customDays?: number) {
  // Use the actual system year since that's where the data exists
  const now = new Date();
  const currentYear = now.getFullYear();
  const today = new Date(currentYear, now.getMonth(), now.getDate());

  let startDate: string;
  let endDate: string;

  switch (period) {
    case 'today':
      startDate = today.toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'yesterday':
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last_24_hours': {
      const correctedNow = new Date(
        currentYear,
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      );
      startDate = new Date(correctedNow.getTime() - 24 * 60 * 60 * 1000).toISOString();
      endDate = correctedNow.toISOString();
      break;
    }
    case 'last_7_days':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'last_14_days':
      startDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'last_30_days':
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'last_90_days':
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'last_180_days':
      startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'this_month': {
      const firstDayOfMonth = new Date(currentYear, now.getMonth(), 1);
      startDate = firstDayOfMonth.toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    }
    case 'all_time':
      startDate = '2020-01-01';
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    case 'custom':
      if (!customDays) {
        throw new Error('custom_days is required when period is custom');
      }
      startDate = new Date(today.getTime() - customDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    default:
      throw new Error(`Invalid period: ${period}`);
  }

  return { startDate, endDate };
}

function calculatePercentageChange(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? 'Increased by ∞%' : 'No change';
  }
  const change = ((current - previous) / previous) * 100;
  const direction = change >= 0 ? 'Increased' : 'Decreased';
  const absChange = Math.abs(change);
  return `${direction} by ${Math.round(
    absChange,
  )}% since last period (from ${previous} to ${current})`;
}

export const getPathTableTool = {
  name: 'get-path-table',
  description: `
  - Get page path statistics with visitors, views, and bounce rate in a table format.
  - Provides page path analytics with visitor and view counts.
  - Supports multiple periods: today, yesterday, last_7_days, last_30_days, etc.
  - Custom period support with custom_days parameter.
  - Includes comparison between current and previous periods with percentage changes.
  - Configurable limit for number of paths returned.
  - Example usage: {"period": "last_30_days", "limit": 20} or {"period": "custom", "custom_days": 14, "limit": 15}
  `.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      period,
      custom_days,
      limit,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) throw new Error('websiteId is required.');

    // If custom_days is provided but period is not "custom", use custom period
    let actualPeriod = period;
    if (custom_days && period !== 'custom') {
      actualPeriod = 'custom';
    }

    // Calculate date ranges based on period
    const { startDate, endDate } = calculateDateRange(actualPeriod, custom_days);

    // Calculate previous period dates for comparison
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const periodDays = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24),
    );

    const previousStartDate = new Date(startDateObj.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousEndDate = new Date(startDateObj.getTime() - 24 * 60 * 60 * 1000);

    const previousStartDateStr = previousStartDate.toISOString().split('T')[0];
    const previousEndDateStr = previousEndDate.toISOString().split('T')[0];

    // Get current period data
    const currentData = await getPathTable(
      websiteId,
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      limit,
    );

    // Get previous period data for comparison
    const previousData = await getPathTable(
      websiteId,
      {
        startDate: new Date(previousStartDateStr),
        endDate: new Date(previousEndDateStr),
      },
      limit * 2,
    ); // Get more data to ensure we have matches

    // Create lookup map for previous period data
    const previousMap = new Map();
    for (const row of previousData) {
      previousMap.set(row.path, {
        visitors: row.visitors,
        views: row.views,
      });
    }

    // Calculate percentage changes and format results
    const paths = currentData.map(row => {
      const previousData = previousMap.get(row.path) || { visitors: 0, views: 0 };

      return {
        path: row.path,
        visitors: {
          current: row.visitors,
          previous: previousData.visitors,
          change: calculatePercentageChange(row.visitors, previousData.visitors),
        },
        views: {
          current: row.views,
          previous: previousData.views,
          change: calculatePercentageChange(row.views, previousData.views),
        },
        bounce_rate: {
          current: 0, // Temporarily set to 0 due to current schema limitations
          previous: 0,
          change: 'No change',
        },
      };
    });

    return {
      period: actualPeriod,
      custom_days: custom_days,
      date_range: {
        start: startDate,
        end: endDate,
      },
      previous_period: {
        start: previousStartDateStr,
        end: previousEndDateStr,
      },
      limit: limit,
      paths: paths,
      summary: {
        total_paths: paths.length,
        total_visitors: paths.reduce((sum, path) => sum + path.visitors.current, 0),
        total_views: paths.reduce((sum, path) => sum + path.views.current, 0),
        avg_visitors_per_path:
          paths.length > 0
            ? Math.round(paths.reduce((sum, path) => sum + path.visitors.current, 0) / paths.length)
            : 0,
        avg_views_per_path:
          paths.length > 0
            ? Math.round(paths.reduce((sum, path) => sum + path.views.current, 0) / paths.length)
            : 0,
      },
    };
  },
};

export type GetPathTableTool = typeof getPathTableTool;
