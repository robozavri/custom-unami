import { z } from 'zod';
import { getSegmentShiftData } from '@/queries/sql/conversion-drop-insights/compare-by-segment-shift';
import { resolveWebsiteId } from '@/app/chat/tools/conversion-drop-insights/check-total-conversion-drop';

export interface CompareBySegmentShiftTool {
  name: 'compare-by-segment-shift';
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (params: any) => Promise<any>;
}

const inputSchema = z.object({
  websiteId: z.string().optional(),
  conversionEvent: z.string().describe('Name of the event considered a conversion'),
  segmentFields: z
    .array(z.string())
    .describe('Array of field names from session table to segment by (e.g. ["device", "country"])'),
  currentFrom: z.string().describe('Start of current period (YYYY-MM-DD)'),
  currentTo: z.string().describe('End of current period (YYYY-MM-DD)'),
  previousFrom: z.string().describe('Start of comparison period (YYYY-MM-DD)'),
  previousTo: z.string().describe('End of comparison period (YYYY-MM-DD)'),
  minVisitors: z.number().min(1).default(5).describe('Minimum unique visitors to include segment'),
});

export const compareBySegmentShiftTool: CompareBySegmentShiftTool = {
  name: 'compare-by-segment-shift',
  description: `Detect and compare conversion rate shifts across user-defined segments between two time periods. 
  
This tool helps uncover which user cohorts are behaving differently over time by analyzing:
- Device type segments (desktop, mobile, tablet)
- Geographic segments (country, region, city)
- Browser and OS segments
- Custom combinations of multiple segment fields

For each segment, it calculates:
- Conversion count and unique visitors for both periods
- Conversion rate for each period
- Rate delta and percent change between periods
- Direction of change (increase/decrease/no change)

Results are sorted by impact to prioritize segments with the most significant changes.`,
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

      // Validate segment fields
      if (!validatedParams.segmentFields || validatedParams.segmentFields.length === 0) {
        throw new Error('At least one segment field must be specified');
      }

      // Validate segment fields are valid session table columns
      const validSessionFields = [
        'device',
        'country',
        'browser',
        'os',
        'language',
        'region',
        'city',
      ];
      const invalidFields = validatedParams.segmentFields.filter(
        field => !validSessionFields.includes(field),
      );
      if (invalidFields.length > 0) {
        throw new Error(
          `Invalid segment fields: ${invalidFields.join(
            ', ',
          )}. Valid fields are: ${validSessionFields.join(', ')}`,
        );
      }

      /* eslint-disable no-console */
      console.log('[compare-by-segment-shift] Executing with params:', validatedParams);
      console.log('[compare-by-segment-shift] Resolved website ID:', websiteId);
      console.log('[compare-by-segment-shift] Segment fields:', validatedParams.segmentFields);

      // Get segment shift data
      const result: any[] = await getSegmentShiftData(
        websiteId,
        validatedParams.conversionEvent,
        validatedParams.segmentFields,
        validatedParams.currentFrom,
        validatedParams.currentTo,
        validatedParams.previousFrom,
        validatedParams.previousTo,
        validatedParams.minVisitors,
      );

      console.log('[compare-by-segment-shift] Tool execution completed successfully');
      console.log('[compare-by-segment-shift] Result count:', result.length);

      return {
        data: result,
        summary: {
          totalSegments: result.length,
          segmentsWithIncrease: result.filter(item => item.change.direction === 'increase').length,
          segmentsWithDecrease: result.filter(item => item.change.direction === 'decrease').length,
          segmentsWithNoChange: result.filter(item => item.change.direction === 'no_change').length,
          topPerformer: result.find(item => item.change.direction === 'increase'),
          worstPerformer: result.find(item => item.change.direction === 'decrease'),
        },
        metadata: {
          websiteId,
          conversionEvent: validatedParams.conversionEvent,
          segmentFields: validatedParams.segmentFields,
          currentPeriod: `${validatedParams.currentFrom} to ${validatedParams.currentTo}`,
          previousPeriod: `${validatedParams.previousFrom} to ${validatedParams.previousTo}`,
          minVisitors: validatedParams.minVisitors,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[compare-by-segment-shift] Tool execution failed:', error);
      throw new Error(`Failed to compare conversion by segment shift: ${error.message}`);
    }
  },
};
