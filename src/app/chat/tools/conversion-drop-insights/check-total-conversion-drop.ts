import { z } from 'zod';
import { getConversionDropData } from '@/queries/sql/conversion-drop-insights/check-total-conversion-drop';
import { getWebsiteId } from '../../state';

const inputSchema = z.object({
  websiteId: z.string().optional(),
  conversionEvent: z.string().describe('Name of the event considered a conversion'),
  currentFrom: z.string().describe('Start of current period (YYYY-MM-DD)'),
  currentTo: z.string().describe('End of current period (YYYY-MM-DD)'),
  previousFrom: z.string().describe('Start of comparison period (YYYY-MM-DD)'),
  previousTo: z.string().describe('End of comparison period (YYYY-MM-DD)'),
});

export interface ConversionDropResult {
  current: {
    conversions: number;
    uniqueVisitors: number;
    conversionRate: number;
  };
  previous: {
    conversions: number;
    uniqueVisitors: number;
    conversionRate: number;
  };
  change: {
    rateDelta: number;
    percentChange: number;
    direction: 'increase' | 'decrease' | 'no_change';
  };
}

export async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

export const checkTotalConversionDropTool = {
  name: 'check-total-conversion-drop',
  description:
    'Compare total conversion performance between two time periods and calculate whether there is a drop in conversion rate or count. Returns conversion metrics for both periods and the change analysis.',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: ConversionDropResult }> => {
    const input = inputSchema.parse(raw);
    const websiteId = await resolveWebsiteId(input.websiteId);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !dateRegex.test(input.currentFrom) ||
      !dateRegex.test(input.currentTo) ||
      !dateRegex.test(input.previousFrom) ||
      !dateRegex.test(input.previousTo)
    ) {
      throw new Error('All date parameters must be in YYYY-MM-DD format');
    }

    // Get conversion data for both periods
    // eslint-disable-next-line no-console
    console.log('🔍 [check-total-conversion-drop] About to call getConversionDropData...');
    const conversionData = await getConversionDropData(
      websiteId,
      input.conversionEvent,
      input.currentFrom,
      input.currentTo,
      input.previousFrom,
      input.previousTo,
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [check-total-conversion-drop] Received conversionData:', conversionData);

    // Calculate change metrics
    const rateDelta =
      conversionData.current.conversionRate - conversionData.previous.conversionRate;
    const percentChange =
      conversionData.previous.conversionRate > 0
        ? (rateDelta / conversionData.previous.conversionRate) * 100
        : 0;

    // Determine direction based on percent change threshold (0.5% to avoid noise)
    let direction: 'increase' | 'decrease' | 'no_change' = 'no_change';
    if (percentChange > 0.5) {
      direction = 'increase';
    } else if (percentChange < -0.5) {
      direction = 'decrease';
    }

    const result: ConversionDropResult = {
      current: conversionData.current,
      previous: conversionData.previous,
      change: {
        rateDelta: Number(rateDelta.toFixed(4)),
        percentChange: Number(percentChange.toFixed(2)),
        direction,
      },
    };

    // eslint-disable-next-line no-console
    console.log('✅ [check-total-conversion-drop] SUCCESS - final result:', result);

    return { data: result };
  },
};

export type CheckTotalConversionDropTool = typeof checkTotalConversionDropTool;
