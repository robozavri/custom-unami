import { z } from 'zod';
import { getPathComparisonData } from '@/queries/sql/conversion-drop-insights/compare-by-path';
import { getWebsiteId } from '../../state';

const inputSchema = z.object({
  websiteId: z.string().optional(),
  conversionEvent: z.string().describe('Name of the event considered a conversion'),
  currentFrom: z.string().describe('Start of current period (YYYY-MM-DD)'),
  currentTo: z.string().describe('End of current period (YYYY-MM-DD)'),
  previousFrom: z.string().describe('Start of comparison period (YYYY-MM-DD)'),
  previousTo: z.string().describe('End of comparison period (YYYY-MM-DD)'),
  minVisitors: z.number().min(1).default(5).describe('Minimum unique visitors to include path'),
});

export interface PathComparisonResult {
  path: string;
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

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

export const compareByPathTool = {
  name: 'compare-by-path',
  description:
    'Compare conversion performance by page path between two time periods. Returns conversion metrics for each path and detects significant increases or decreases.',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: PathComparisonResult[] }> => {
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

    // Get path comparison data
    // eslint-disable-next-line no-console
    console.log('🔍 [compare-by-path] About to call getPathComparisonData...');
    const pathData = await getPathComparisonData(
      websiteId,
      input.conversionEvent,
      input.currentFrom,
      input.currentTo,
      input.previousFrom,
      input.previousTo,
      input.minVisitors,
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [compare-by-path] Received pathData:', pathData);

    // Calculate change metrics for each path
    const result: PathComparisonResult[] = pathData.map(path => {
      const rateDelta = path.current.conversionRate - path.previous.conversionRate;
      const percentChange =
        path.previous.conversionRate > 0 ? (rateDelta / path.previous.conversionRate) * 100 : 0;

      // Determine direction based on percent change threshold (0.5% to avoid noise)
      let direction: 'increase' | 'decrease' | 'no_change' = 'no_change';
      if (percentChange > 0.5) {
        direction = 'increase';
      } else if (percentChange < -0.5) {
        direction = 'decrease';
      }

      return {
        path: path.path,
        current: path.current,
        previous: path.previous,
        change: {
          rateDelta: Number(rateDelta.toFixed(4)),
          percentChange: Number(percentChange.toFixed(2)),
          direction,
        },
      };
    });

    // eslint-disable-next-line no-console
    console.log('✅ [compare-by-path] SUCCESS - final result:', result);

    return { data: result };
  },
};

export type CompareByPathTool = typeof compareByPathTool;
