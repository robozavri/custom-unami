import { z } from 'zod';
import { getDeviceConversionData } from '@/queries/sql/conversion-drop-insights/compare-by-device';
import { resolveWebsiteId } from '@/app/chat/tools/conversion-drop-insights/check-total-conversion-drop';

export interface CompareByDeviceTool {
  name: 'compare-by-device';
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (params: any) => Promise<any>;
}

const inputSchema = z.object({
  websiteId: z.string().optional(),
  conversionEvent: z.string().describe('Name of the event considered a conversion'),
  currentFrom: z.string().describe('Start of current period (YYYY-MM-DD)'),
  currentTo: z.string().describe('End of current period (YYYY-MM-DD)'),
  previousFrom: z.string().describe('Start of comparison period (YYYY-MM-DD)'),
  previousTo: z.string().describe('End of comparison period (YYYY-MM-DD)'),
  minVisitors: z.number().min(1).default(5).describe('Minimum unique visitors to include device'),
});

export const compareByDeviceTool: CompareByDeviceTool = {
  name: 'compare-by-device',
  description: `Compare conversion performance by device type between two time periods. 
  
This tool helps identify device-specific performance changes that may indicate:
- Mobile optimization issues
- Desktop vs mobile user behavior shifts
- Device-specific conversion problems
- Cross-platform performance variations

For each device type, it calculates:
- Conversion count and unique visitors for both periods
- Conversion rate for each period
- Rate delta and percent change between periods
- Direction of change (increase/decrease/no change)

Results are sorted by impact to prioritize devices with the most significant changes.`,
  inputSchema,
  execute: async (params: z.infer<typeof inputSchema>) => {
    try {
      // Validate input
      const validatedParams = inputSchema.parse(params);

      // Resolve website ID
      const websiteId = await resolveWebsiteId(validatedParams.websiteId);

      // Validate date formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (
        !dateRegex.test(validatedParams.currentFrom) ||
        !dateRegex.test(validatedParams.currentTo) ||
        !dateRegex.test(validatedParams.previousFrom) ||
        !dateRegex.test(validatedParams.previousTo)
      ) {
        throw new Error('All dates must be in YYYY-MM-DD format');
      }
      /* eslint-disable no-console */
      console.log('[compare-by-device] Executing with params:', validatedParams);
      console.log('[compare-by-device] Resolved website ID:', websiteId);

      // Get device conversion data
      const result: any[] = await getDeviceConversionData(
        websiteId,
        validatedParams.conversionEvent,
        validatedParams.currentFrom,
        validatedParams.currentTo,
        validatedParams.previousFrom,
        validatedParams.previousTo,
        validatedParams.minVisitors,
      );

      console.log('[compare-by-device] Tool execution completed successfully');
      console.log('[compare-by-device] Result count:', result.length);

      return {
        data: result,
        summary: {
          totalDevices: result.length,
          devicesWithIncrease: result.filter(item => item.change.direction === 'increase').length,
          devicesWithDecrease: result.filter(item => item.change.direction === 'decrease').length,
          devicesWithNoChange: result.filter(item => item.change.direction === 'no_change').length,
          topPerformer: result.find(item => item.change.direction === 'increase'),
          worstPerformer: result.find(item => item.change.direction === 'decrease'),
        },
        metadata: {
          websiteId,
          conversionEvent: validatedParams.conversionEvent,
          currentPeriod: `${validatedParams.currentFrom} to ${validatedParams.currentTo}`,
          previousPeriod: `${validatedParams.previousFrom} to ${validatedParams.previousTo}`,
          minVisitors: validatedParams.minVisitors,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[compare-by-device] Tool execution failed:', error);
      throw new Error(`Failed to compare conversion by device: ${error.message}`);
    }
  },
};
