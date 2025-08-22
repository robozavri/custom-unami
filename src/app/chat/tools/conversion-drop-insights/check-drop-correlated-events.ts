import { z } from 'zod';
import { getDropCorrelatedEventsData } from '@/queries/sql/conversion-drop-insights/check-drop-correlated-events';
import { resolveWebsiteId } from '@/app/chat/tools/conversion-drop-insights/check-total-conversion-drop';
/* eslint-disable no-console */

export interface CheckDropCorrelatedEventsTool {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (params: any) => Promise<any>;
}

const inputSchema = z.object({
  websiteId: z.string().optional(),
  targetEvent: z
    .string()
    .describe(
      'The conversion event to check against (e.g., "checkout_complete", "signup_complete")',
    ),
  from: z.string().describe('Start of time range (YYYY-MM-DD)'),
  to: z.string().describe('End of time range (YYYY-MM-DD)'),
  compareWithConverters: z
    .boolean()
    .default(false)
    .describe('Whether to compare drop events with converting sessions'),
});

export const checkDropCorrelatedEventsTool: CheckDropCorrelatedEventsTool = {
  name: 'check-drop-correlated-events',
  description:
    'Identify which events are strongly correlated with users who drop off and fail to reach the target conversion. This helps identify distracting, confusing, or problematic behavior patterns.',
  inputSchema,
  execute: async (params: any) => {
    try {
      console.log('[check-drop-correlated-events] Executing with params:', params);

      // Resolve website ID
      const websiteId = await resolveWebsiteId(params.websiteId);
      console.log('[check-drop-correlated-events] Resolved website ID:', websiteId);

      const { targetEvent, from, to, compareWithConverters } = params;

      console.log('[check-drop-correlated-events] Target event:', targetEvent);
      console.log('[check-drop-correlated-events] Date range:', from, 'to', to);
      console.log('[check-drop-correlated-events] Compare with converters:', compareWithConverters);

      // Get the data
      const result = await getDropCorrelatedEventsData(
        websiteId,
        targetEvent,
        from,
        to,
        compareWithConverters,
      );

      console.log('[check-drop-correlated-events] Tool execution completed successfully');
      console.log('[check-drop-correlated-events] Result count:', result.length, 'events');

      // Calculate summary metrics
      const totalDropSessions = result.reduce((sum, event) => sum + event.dropSessionCount, 0);
      const avgDropPercent =
        result.length > 0
          ? result.reduce((sum, event) => sum + event.dropSessionPercent, 0) / result.length
          : 0;

      // Find the event with the highest drop correlation
      const highestCorrelationEvent = result.length > 0 ? result[0] : null;
      const highestCorrelationPercent = highestCorrelationEvent?.dropSessionPercent || 0;

      // Build summary
      const summary = {
        totalEventsAnalyzed: result.length,
        totalDropSessions,
        averageDropSessionPercent: avgDropPercent,
        eventWithHighestCorrelation: highestCorrelationEvent?.event || 'N/A',
        highestCorrelationPercent,
        comparisonEnabled: compareWithConverters,
      };

      // Build metadata
      const metadata = {
        websiteId,
        targetEvent,
        dateRange: { from, to },
        compareWithConverters,
        analysisType: 'drop_correlated_events',
        generatedAt: new Date().toISOString(),
      };

      return {
        data: result,
        summary,
        metadata,
      };
    } catch (error: any) {
      console.error('[check-drop-correlated-events] Tool execution failed:', error);
      throw new Error(`Failed to check drop correlated events: ${error.message}`);
    }
  },
};
