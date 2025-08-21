import { z } from 'zod';
import { getWebsiteStats } from '@/queries';
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

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  period: periodEnum.default('today'),
  custom_days: z.number().int().positive().max(365).optional(),
  date_from: z.string().optional(), // YYYY-MM-DD
  date_to: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
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
  - Get comprehensive web analytics statistics with comparison data using the same logic as the dashboard.
  - Includes page views, visitors (sessions), visits, bounce rate, and visit duration.
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

    // Log input parameters
    // eslint-disable-next-line no-console
    console.log('🔍 get-web-statistic tool input params:', {
      websiteId: websiteIdInput,
      period,
      custom_days,
      rawParams,
    });

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) throw new Error('websiteId is required.');

    // eslint-disable-next-line no-console
    console.log('🔍 Resolved websiteId:', websiteId);

    // If custom_days is provided but period is not "custom", use custom period
    let actualPeriod = period;
    if (custom_days && period !== 'custom') {
      actualPeriod = 'custom';
      // eslint-disable-next-line no-console
      console.log('🔄 Period adjusted to custom due to custom_days parameter');
    }

    // eslint-disable-next-line no-console
    console.log('🔍 Using period:', actualPeriod);
    // eslint-disable-next-line no-console
    console.log('🔍 Date parameters check:', {
      hasDateFrom: !!(rawParams as any).date_from,
      hasDateTo: !!(rawParams as any).date_to,
      dateFrom: (rawParams as any).date_from,
      dateTo: (rawParams as any).date_to,
    });

    // Calculate date ranges - prioritize date_from/date_to if provided
    let currentStart: string;
    let currentEnd: string;
    let previousStart: string;
    let previousEnd: string;

    if ((rawParams as any).date_from && (rawParams as any).date_to) {
      // Use provided date range
      currentStart = (rawParams as any).date_from;
      currentEnd = (rawParams as any).date_to;

      // Calculate previous period as same length before current start
      const currentStartDate = new Date(currentStart);
      const currentEndDate = new Date(currentEnd);
      const periodLengthMs = currentEndDate.getTime() - currentStartDate.getTime();

      const previousEndDate = new Date(currentStartDate.getTime() - 1); // Day before current start
      const previousStartDate = new Date(previousEndDate.getTime() - periodLengthMs);

      previousStart = previousStartDate.toISOString().split('T')[0];
      previousEnd = previousEndDate.toISOString().split('T')[0];

      // eslint-disable-next-line no-console
      console.log('📅 Using provided date range:', {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      });
    } else {
      // Fall back to calculated date ranges based on period
      const dateRanges = calculateDateRanges(actualPeriod, custom_days);
      currentStart = dateRanges.currentStart;
      currentEnd = dateRanges.currentEnd;
      previousStart = dateRanges.previousStart;
      previousEnd = dateRanges.previousEnd;

      // eslint-disable-next-line no-console
      console.log('📅 Using calculated date range:', {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      });
    }

    // eslint-disable-next-line no-console
    console.log('📅 Calculated date ranges:', {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    });

    // Get current period statistics using getWebsiteStats (same as dashboard)
    // eslint-disable-next-line no-console
    console.log('📊 Fetching current period stats for:', {
      startDate: currentStart,
      endDate: currentEnd,
    });

    const currentStatsResult = await getWebsiteStats(websiteId, {
      startDate: new Date(currentStart),
      endDate: new Date(currentEnd),
    });
    const currentStats = currentStatsResult[0] || {};

    // eslint-disable-next-line no-console
    console.log('📊 Raw current stats result:', currentStatsResult);
    // eslint-disable-next-line no-console
    console.log('📊 Current stats object:', currentStats);

    // Get previous period statistics for comparison
    // eslint-disable-next-line no-console
    console.log('📊 Fetching previous period stats for:', {
      startDate: previousStart,
      endDate: previousEnd,
    });

    const previousStatsResult = await getWebsiteStats(websiteId, {
      startDate: new Date(previousStart),
      endDate: new Date(previousEnd),
    });
    const previousStats = previousStatsResult[0] || {};

    // eslint-disable-next-line no-console
    console.log('📊 Raw previous stats result:', previousStatsResult);
    // eslint-disable-next-line no-console
    console.log('📊 Previous stats object:', previousStats);

    // Convert BigInt values to regular numbers (same as dashboard)
    // eslint-disable-next-line no-console
    console.log('🔄 Converting BigInt values to regular numbers...');

    const current = {
      pageviews: Number((currentStats as any).pageviews) || 0,
      visitors: Number((currentStats as any).visitors) || 0,
      visits: Number((currentStats as any).visits) || 0,
      bounces: Number((currentStats as any).bounces) || 0,
      totaltime: Number((currentStats as any).totaltime) || 0,
    };
    const previous = {
      pageviews: Number((previousStats as any).pageviews) || 0,
      visitors: Number((previousStats as any).visitors) || 0,
      visits: Number((previousStats as any).visits) || 0,
      bounces: Number((previousStats as any).bounces) || 0,
      totaltime: Number((previousStats as any).totaltime) || 0,
    };

    // eslint-disable-next-line no-console
    console.log('🔄 Converted current stats:', current);
    // eslint-disable-next-line no-console
    console.log('🔄 Converted previous stats:', previous);

    // Calculate percentage changes
    // eslint-disable-next-line no-console
    console.log('🧮 Calculating percentage changes...');

    const pageViewsChangePercentage = calculatePercentageChange(
      current.pageviews,
      previous.pageviews,
    );
    const visitorsChangePercentage = calculatePercentageChange(current.visitors, previous.visitors);
    const visitsChangePercentage = calculatePercentageChange(current.visits, previous.visits);
    const totalTimeChangePercentage = calculatePercentageChange(
      current.totaltime,
      previous.totaltime,
    );

    // eslint-disable-next-line no-console
    console.log('🧮 Percentage changes calculated:', {
      pageViews: pageViewsChangePercentage,
      visitors: visitorsChangePercentage,
      visits: visitsChangePercentage,
      totalTime: totalTimeChangePercentage,
    });

    // Calculate bounce rates
    // eslint-disable-next-line no-console
    console.log('🧮 Calculating bounce rates...');

    const currentBounceRate =
      current.visits > 0 ? Math.round((current.bounces / current.visits) * 100) : 0;
    const previousBounceRate =
      previous.visits > 0 ? Math.round((previous.bounces / previous.visits) * 100) : 0;
    const bounceRateChangePercentage = calculatePercentageChange(
      currentBounceRate,
      previousBounceRate,
    );

    // eslint-disable-next-line no-console
    console.log('🧮 Bounce rates calculated:', {
      current: currentBounceRate,
      previous: previousBounceRate,
      change: bounceRateChangePercentage,
    });

    // Calculate average visit duration
    // eslint-disable-next-line no-console
    console.log('🧮 Calculating average visit duration...');

    const currentAvgVisitDuration = current.visits > 0 ? current.totaltime / current.visits : 0;
    const previousAvgVisitDuration = previous.visits > 0 ? previous.totaltime / previous.visits : 0;

    // eslint-disable-next-line no-console
    console.log('🧮 Visit duration calculated:', {
      current: {
        seconds: currentAvgVisitDuration,
        formatted: formatDuration(currentAvgVisitDuration),
      },
      previous: {
        seconds: previousAvgVisitDuration,
        formatted: formatDuration(previousAvgVisitDuration),
      },
    });

    // eslint-disable-next-line no-console
    console.log('🏗️ Building final result object...');

    const result = {
      page_views: {
        current: current.pageviews,
        previous: previous.pageviews,
        change_percentage: pageViewsChangePercentage,
        comparison: `Page views: ${
          pageViewsChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(pageViewsChangePercentage)}%, to ${current.pageviews} from ${
          previous.pageviews
        }`,
      },
      visitors: {
        current: current.visitors,
        previous: previous.visitors,
        change_percentage: visitorsChangePercentage,
        comparison: `Visitors: ${
          visitorsChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(visitorsChangePercentage)}%, to ${current.visitors} from ${
          previous.visitors
        }`,
      },
      visits: {
        current: current.visits,
        previous: previous.visits,
        change_percentage: visitsChangePercentage,
        comparison: `Visits: ${
          visitsChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(visitsChangePercentage)}%, to ${current.visits} from ${previous.visits}`,
      },
      visit_duration: {
        current_seconds: currentAvgVisitDuration,
        previous_seconds: previousAvgVisitDuration,
        current_formatted: formatDuration(currentAvgVisitDuration),
        previous_formatted: formatDuration(previousAvgVisitDuration),
        change_percentage: totalTimeChangePercentage,
        comparison: `Visit duration: ${
          totalTimeChangePercentage >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(totalTimeChangePercentage)}%, to ${formatDuration(
          currentAvgVisitDuration,
        )} from ${formatDuration(previousAvgVisitDuration)}`,
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

    // Log the result
    // eslint-disable-next-line no-console
    console.log('✅ get-web-statistic tool result:', result);

    return result;
  },
};

export type GetWebStatisticTool = typeof getWebStatisticTool;
