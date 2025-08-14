import { z } from 'zod';
import { getWebStatistics } from '@/queries';
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
  period: periodEnum.default('today'),
  custom_days: z.number().int().positive().max(365).optional(),
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

function calculateDateRanges(period: string, customDays?: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let currentStart: string;
  let currentEnd: string;
  let previousStart: string;
  let previousEnd: string;

  switch (period) {
    case 'today':
      currentStart = today.toISOString().split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      previousEnd = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'yesterday':
      currentStart = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      currentEnd = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
      previousEnd = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last_24_hours':
      currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      currentEnd = now.toISOString();
      previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      previousEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'last_7_days':
      currentStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      previousEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last_14_days':
      currentStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      previousEnd = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      break;
    case 'last_30_days':
      currentStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      previousEnd = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      break;
    case 'last_90_days':
      currentStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      previousEnd = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      break;
    case 'last_180_days':
      currentStart = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - 360 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      previousEnd = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      break;
    case 'this_month': {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart = firstDayOfMonth.toISOString().split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      previousStart = firstDayOfLastMonth.toISOString().split('T')[0];
      previousEnd = lastDayOfLastMonth.toISOString().split('T')[0];
      break;
    }
    case 'all_time':
      currentStart = '2020-01-01'; // Arbitrary start date
      currentEnd = today.toISOString().split('T')[0];
      previousStart = '2020-01-01';
      previousEnd = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      break;
    case 'custom':
      if (!customDays) {
        throw new Error('custom_days is required when period is custom');
      }
      currentStart = new Date(today.getTime() - customDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      currentEnd = today.toISOString().split('T')[0];
      previousStart = new Date(today.getTime() - customDays * 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      previousEnd = new Date(today.getTime() - customDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      break;
    default:
      throw new Error(`Invalid period: ${period}`);
  }

  return { currentStart, currentEnd, previousStart, previousEnd };
}

function calculatePercentageChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export const getWebStatisticTool = {
  name: 'get-web-statistic',
  description: `
  - Get comprehensive web analytics statistics with comparison data.
  - Includes visitors, page views, sessions, session duration, and bounce rate.
  - Supports multiple periods: today, yesterday, last_7_days, last_30_days, etc.
  - Provides percentage change comparisons between current and previous periods.
  - Custom period support with custom_days parameter.
  - Example usage: {"period": "today"} or {"period": "custom", "custom_days": 14}
  `.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      period,
      custom_days,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) throw new Error('websiteId is required.');

    // If custom_days is provided but period is not "custom", use custom period
    let actualPeriod = period;
    if (custom_days && period !== 'custom') {
      actualPeriod = 'custom';
    }

    // Calculate date ranges based on period
    const { currentStart, currentEnd, previousStart, previousEnd } = calculateDateRanges(
      actualPeriod,
      custom_days,
    );

    // Get current period statistics
    const currentStats = await getWebStatistics(websiteId, {
      startDate: new Date(currentStart),
      endDate: new Date(currentEnd),
    });

    // Get previous period statistics for comparison
    const previousStats = await getWebStatistics(websiteId, {
      startDate: new Date(previousStart),
      endDate: new Date(previousEnd),
    });

    // Calculate percentage changes
    const visitorsChangePercentage = calculatePercentageChange(
      currentStats.visitors,
      previousStats.visitors,
    );
    const pageViewsChangePercentage = calculatePercentageChange(
      currentStats.page_views,
      previousStats.page_views,
    );
    const sessionsChangePercentage = calculatePercentageChange(
      currentStats.sessions,
      previousStats.sessions,
    );
    const sessionDurationChangePercentage = calculatePercentageChange(
      currentStats.avg_session_duration_seconds,
      previousStats.avg_session_duration_seconds,
    );

    // Calculate bounce rates
    const currentBounceRate =
      currentStats.sessions > 0
        ? Math.round((currentStats.bounce_sessions / currentStats.sessions) * 100)
        : 0;
    const previousBounceRate =
      previousStats.sessions > 0
        ? Math.round((previousStats.bounce_sessions / previousStats.sessions) * 100)
        : 0;
    const bounceRateChangePercentage = calculatePercentageChange(
      currentBounceRate,
      previousBounceRate,
    );

    return {
      visitors: {
        current: currentStats.visitors,
        previous: previousStats.visitors,
        change_percentage: visitorsChangePercentage,
        comparison: `Visitors: ${
          visitorsChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(visitorsChangePercentage)}%, to ${currentStats.visitors} from ${
          previousStats.visitors
        }`,
      },
      page_views: {
        current: currentStats.page_views,
        previous: previousStats.page_views,
        change_percentage: pageViewsChangePercentage,
        comparison: `Page views: ${
          pageViewsChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(pageViewsChangePercentage)}%, to ${currentStats.page_views} from ${
          previousStats.page_views
        }`,
      },
      sessions: {
        current: currentStats.sessions,
        previous: previousStats.sessions,
        change_percentage: sessionsChangePercentage,
        comparison: `Sessions: ${
          sessionsChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(sessionsChangePercentage)}%, to ${currentStats.sessions} from ${
          previousStats.sessions
        }`,
      },
      session_duration: {
        current_seconds: currentStats.avg_session_duration_seconds,
        previous_seconds: previousStats.avg_session_duration_seconds,
        current_formatted: formatDuration(currentStats.avg_session_duration_seconds),
        previous_formatted: formatDuration(previousStats.avg_session_duration_seconds),
        change_percentage: sessionDurationChangePercentage,
        comparison: `Session duration: ${
          sessionDurationChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(sessionDurationChangePercentage)}%, to ${formatDuration(
          currentStats.avg_session_duration_seconds,
        )} from ${formatDuration(previousStats.avg_session_duration_seconds)}`,
      },
      bounce_rate: {
        current: currentBounceRate,
        previous: previousBounceRate,
        change_percentage: bounceRateChangePercentage,
        comparison: `Bounce rate: ${
          bounceRateChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(
          bounceRateChangePercentage,
        )}%, to ${currentBounceRate}% from ${previousBounceRate}%`,
      },
      period: actualPeriod,
      custom_days: custom_days,
      date_ranges: {
        current_start: currentStart,
        current_end: currentEnd,
        previous_start: previousStart,
        previous_end: previousEnd,
      },
    };
  },
};

export type GetWebStatisticTool = typeof getWebStatisticTool;
