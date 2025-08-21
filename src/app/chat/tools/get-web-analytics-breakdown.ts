import { z } from 'zod';
import { getWebAnalyticsBreakdown } from '@/queries';
import { getWebsiteId } from '../state';

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

const groupByEnum = z.enum(['hour', 'day', 'week', 'month']);

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  period: periodEnum.default('last_7_days'),
  group_by: groupByEnum.default('day'),
  custom_days: z.number().int().positive().max(365).optional(),
});

type Params = z.infer<typeof paramsSchema>;

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

function calculateDateRange(period: string, customDays?: number) {
  // FIX: Use the actual system year since that's where the data exists
  const now = new Date();
  const currentYear = now.getFullYear(); // Use actual system year (2025) where data exists
  const today = new Date(currentYear, now.getMonth(), now.getDate());

  let startDate: string;
  let endDate: string;

  switch (period) {
    case 'today':
      startDate = today.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'yesterday':
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last_24_hours': {
      // For last 24 hours, use actual current time but with correct year
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
      // Extend end date to end of day (23:59:59) to capture all data
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
      startDate = '2020-01-01'; // Arbitrary start date
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

export const getWebAnalyticsBreakdownTool = {
  name: 'get-web-analytics-breakdown',
  description: `
  - Get detailed web analytics breakdown including unique visitors, page views, and unique sessions grouped by time intervals.
  - Supports time grouping: hour, day, week, month.
  - Supports multiple periods: today, yesterday, last_7_days, last_30_days, etc.
  - Custom period support with custom_days parameter.
  - Returns data grouped by time intervals with metrics per interval.
  - Example usage: {"period": "last_7_days", "group_by": "day"} or {"period": "custom", "custom_days": 14, "group_by": "hour"}
  `.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      period,
      group_by,
      custom_days,
    } = paramsSchema.parse(rawParams as Params);

    // Log input parameters
    // eslint-disable-next-line no-console
    console.log('🔍 get-web-analytics-breakdown tool input params:', {
      websiteId: websiteIdInput,
      period,
      group_by,
      custom_days,
      rawParams,
    });

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) throw new Error('websiteId is required.');

    // If custom_days is provided but period is not "custom", use custom period
    let actualPeriod = period;
    if (custom_days && period !== 'custom') {
      actualPeriod = 'custom';
    }

    // TEMPORARY: Force a broader date range to test if data exists
    // actualPeriod = 'last_90_days'; // Uncomment this line to test with broader range

    // Calculate date ranges based on period
    const { startDate, endDate } = calculateDateRange(actualPeriod, custom_days);

    let breakdown;
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000),
      );

      const queryPromise = getWebAnalyticsBreakdown(
        websiteId,
        { startDate: new Date(startDate), endDate: new Date(endDate) },
        group_by,
      );

      breakdown = await Promise.race([queryPromise, timeoutPromise]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('get-web-analytics-breakdown: getWebAnalyticsBreakdown failed:', error);
      throw new Error(
        `Failed to get web analytics breakdown: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const result = {
      period: actualPeriod,
      group_by: group_by,
      custom_days: custom_days,
      date_range: {
        start: startDate,
        end: endDate,
      },
      unique_visitors: breakdown.unique_visitors,
      page_views: breakdown.page_views,
      unique_sessions: breakdown.unique_sessions,
      summary: {
        total_intervals: breakdown.unique_visitors.length,
        total_visitors: breakdown.unique_visitors.reduce(
          (sum, row) => sum + row.unique_visitors,
          0,
        ),
        total_page_views: breakdown.page_views.reduce((sum, row) => sum + row.page_views, 0),
        total_sessions: breakdown.unique_sessions.reduce(
          (sum, row) => sum + row.unique_sessions,
          0,
        ),
        avg_visitors_per_interval:
          breakdown.unique_visitors.length > 0
            ? Math.round(
                breakdown.unique_visitors.reduce((sum, row) => sum + row.unique_visitors, 0) /
                  breakdown.unique_visitors.length,
              )
            : 0,
        avg_page_views_per_interval:
          breakdown.page_views.length > 0
            ? Math.round(
                breakdown.page_views.reduce((sum, row) => sum + row.page_views, 0) /
                  breakdown.page_views.length,
              )
            : 0,
        avg_sessions_per_interval:
          breakdown.unique_sessions.length > 0
            ? Math.round(
                breakdown.unique_sessions.reduce((sum, row) => sum + row.unique_sessions, 0) /
                  breakdown.unique_sessions.length,
              )
            : 0,
      },
    };

    // Log the result
    // eslint-disable-next-line no-console
    console.log('✅ get-web-analytics-breakdown tool result:', result);

    return result;
  },
};

export type GetWebAnalyticsBreakdownTool = typeof getWebAnalyticsBreakdownTool;
