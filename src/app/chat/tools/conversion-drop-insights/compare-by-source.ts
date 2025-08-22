import { z } from 'zod';
import { getSourceComparisonData } from '@/queries/sql/conversion-drop-insights/compare-by-source';
import { getWebsiteId } from '../../state';

const inputSchema = z.object({
  websiteId: z.string().optional(),
  conversionEvent: z.string().describe('Name of the event considered a conversion'),
  currentFrom: z.string().describe('Start of current period (YYYY-MM-DD)'),
  currentTo: z.string().describe('End of current period (YYYY-MM-DD)'),
  previousFrom: z.string().describe('Start of comparison period (YYYY-MM-DD)'),
  previousTo: z.string().describe('End of comparison period (YYYY-MM-DD)'),
  minVisitors: z.number().min(1).default(5).describe('Minimum unique visitors to include source'),
});

export interface SourceComparisonResult {
  source: string;
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

export const compareBySourceTool = {
  name: 'compare-by-source',
  description:
    'Compare conversion performance per traffic source (referrer domain) between two time periods. Returns conversion metrics for each source and detects significant increases or decreases.',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: SourceComparisonResult[] }> => {
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

    // Get source comparison data
    // eslint-disable-next-line no-console
    console.log('🔍 [compare-by-source] About to call getSourceComparisonData...');
    const sourceData = await getSourceComparisonData(
      websiteId,
      input.conversionEvent,
      input.currentFrom,
      input.currentTo,
      input.previousFrom,
      input.previousTo,
      input.minVisitors,
    );
    // eslint-disable-next-line no-console
    console.log('🔍 [compare-by-source] Received sourceData:', sourceData);

    // Calculate change metrics for each source
    const result: SourceComparisonResult[] = sourceData.map(source => {
      const rateDelta = source.current.conversionRate - source.previous.conversionRate;
      const percentChange =
        source.previous.conversionRate > 0 ? (rateDelta / source.previous.conversionRate) * 100 : 0;

      // Determine direction based on percent change threshold (0.5% to avoid noise)
      let direction: 'increase' | 'decrease' | 'no_change' = 'no_change';
      if (percentChange > 0.5) {
        direction = 'increase';
      } else if (percentChange < -0.5) {
        direction = 'decrease';
      }

      return {
        source: source.source,
        current: source.current,
        previous: source.previous,
        change: {
          rateDelta: Number(rateDelta.toFixed(4)),
          percentChange: Number(percentChange.toFixed(2)),
          direction,
        },
      };
    });

    // eslint-disable-next-line no-console
    console.log('✅ [compare-by-source] SUCCESS - final result:', result);

    return { data: result };
  },
};

export type CompareBySourceTool = typeof compareBySourceTool;
