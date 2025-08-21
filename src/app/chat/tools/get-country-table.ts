import { z } from 'zod';
import { getCountryTable } from '@/queries';
import prisma from '@/lib/prisma';
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
  period: periodEnum.default('all_time'), // Changed from 'last_30_days' to 'all_time'
  custom_days: z.number().int().positive().max(365).optional(),
  limit: z.number().int().positive().max(100).default(10),
});

type Params = z.infer<typeof paramsSchema>;

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

async function getAvailableDataRange(
  websiteId: string,
): Promise<{ startDate: string; endDate: string } | null> {
  try {
    const { rawQuery } = prisma;
    const result = await rawQuery(
      `
      select
        min(website_event.created_at) as earliest_date,
        max(website_event.created_at) as latest_date
      from website_event
      where website_event.website_id = {{websiteId::uuid}}
      `,
      { websiteId },
    );

    if (result && result.length > 0 && result[0].earliest_date && result[0].latest_date) {
      return {
        startDate: result[0].earliest_date.toISOString().split('T')[0],
        endDate: result[0].latest_date.toISOString().split('T')[0],
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

function calculateDateRange(period: string, customDays?: number) {
  // Use the current system date instead of hardcoded dates
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today

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
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
      startDate = startTime.toISOString();
      endDate = endTime.toISOString();
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
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate = firstDayOfMonth.toISOString().split('T')[0];
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString().split('T')[0];
      break;
    }
    case 'all_time':
      // For all_time, don't set any date limits - let the database handle it
      return { startDate: undefined, endDate: undefined };
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
    if (current === 0) {
      return 'No change';
    }
    // When there's no previous data but current data exists, show "New data"
    return 'New data';
  }
  const change = ((current - previous) / previous) * 100;
  const direction = change >= 0 ? 'Increased' : 'Decreased';
  const absChange = Math.abs(change);
  return `${direction} by ${Math.round(
    absChange,
  )}% since last period (from ${previous} to ${current})`;
}

export const getCountryTableTool = {
  name: 'get-country-table',
  description: `
  - Get country statistics with visitors and views in a table format with comparison data.
  - Provides country-based analytics with visitor and view counts.
  - Supports multiple periods: today, yesterday, last_7_days, last_30_days, etc.
  - Custom period support with custom_days parameter.
  - Includes comparison between current and previous periods with percentage changes.
  - Configurable limit for number of countries returned.
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
    let { startDate, endDate } = calculateDateRange(actualPeriod, custom_days);

    // Check what data is actually available in the database
    const availableDataRange = await getAvailableDataRange(websiteId);

    // If we have date filters but they don't overlap with available data, adjust the period
    if (startDate && endDate && availableDataRange) {
      const requestedStart = new Date(startDate);
      const requestedEnd = new Date(endDate);
      const availableStart = new Date(availableDataRange.startDate);
      const availableEnd = new Date(availableDataRange.endDate);

      // Check if there's any overlap
      if (requestedEnd < availableStart || requestedStart > availableEnd) {
        actualPeriod = 'all_time';
        // Clear the date filters since they don't match available data
        startDate = undefined;
        endDate = undefined;
      }
    }

    // Calculate previous period dates for comparison
    let previousStartDateStr: string | undefined;
    let previousEndDateStr: string | undefined;

    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const periodDays = Math.ceil(
        (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24),
      );

      const previousStartDate = new Date(startDateObj.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousEndDate = new Date(startDateObj.getTime() - 24 * 60 * 60 * 1000);

      previousStartDateStr = previousStartDate.toISOString().split('T')[0];
      previousEndDateStr = previousEndDate.toISOString().split('T')[0];
    }

    // Get current period data
    let currentData = await getCountryTable(
      websiteId,
      // Only pass date filters if they are defined
      startDate && endDate
        ? {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          }
        : {},
      limit,
    );

    // If no data found with date filters, try without date filters to see what's available
    if (currentData.length === 0 && startDate && endDate) {
      currentData = await getCountryTable(websiteId, {}, limit);

      if (currentData.length > 0) {
        // Update the period to reflect that we're actually using all available data
        actualPeriod = 'all_time';
        // Update the date range to show what data is actually available
        if (availableDataRange) {
          startDate = availableDataRange.startDate;
          endDate = availableDataRange.endDate;
        }
      }
    }

    // Get previous period data for comparison
    let previousData = await getCountryTable(
      websiteId,
      // Only pass date filters if they are defined
      startDate && endDate
        ? {
            startDate: new Date(previousStartDateStr),
            endDate: new Date(previousEndDateStr),
          }
        : {},
      limit * 2, // Get more data to ensure we have matches
    );

    // If no previous period data found, use empty array for comparison
    if (previousData.length === 0) {
      previousData = [];
    }

    // Create lookup map for previous period data
    const previousMap = new Map();
    for (const row of previousData) {
      previousMap.set(row.country, {
        visitors: row.visitors,
        views: row.views,
      });
    }

    // Calculate percentage changes and format results
    const countries = currentData.map(row => {
      const previousData = previousMap.get(row.country) || { visitors: 0, views: 0 };

      // Check if we have meaningful previous period data for comparison
      const hasPreviousData = previousStartDateStr && previousEndDateStr && previousData.length > 0;

      // If no previous period data available, show "No comparison data" instead of calculating percentages
      const visitorChange = hasPreviousData
        ? calculatePercentageChange(row.visitors, previousData.visitors)
        : 'No comparison data';
      const viewChange = hasPreviousData
        ? calculatePercentageChange(row.views, previousData.views)
        : 'No comparison data';

      return {
        country: row.country,
        visitors: {
          current: row.visitors,
          previous: previousData.visitors,
          change: visitorChange,
        },
        views: {
          current: row.views,
          previous: previousData.views,
          change: viewChange,
        },
      };
    });

    const result = {
      period: actualPeriod,
      custom_days: custom_days,
      date_range:
        startDate && endDate
          ? {
              start: startDate,
              end: endDate,
            }
          : { start: 'all_time', end: 'all_time' },
      previous_period:
        previousStartDateStr && previousEndDateStr
          ? {
              start: previousStartDateStr,
              end: previousEndDateStr,
            }
          : undefined,
      limit: limit,
      countries: countries,
      summary: {
        total_countries: countries.length,
        total_visitors: countries.reduce((sum, country) => sum + country.visitors.current, 0),
        total_views: countries.reduce((sum, country) => sum + country.views.current, 0),
        avg_visitors_per_country:
          countries.length > 0
            ? Math.round(
                countries.reduce((sum, country) => sum + country.visitors.current, 0) /
                  countries.length,
              )
            : 0,
        avg_views_per_country:
          countries.length > 0
            ? Math.round(
                countries.reduce((sum, country) => sum + country.views.current, 0) /
                  countries.length,
              )
            : 0,
      },
    };

    return result;
  },
};

export type GetCountryTableTool = typeof getCountryTableTool;
