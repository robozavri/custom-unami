import { z } from 'zod';
import { getDropCorrelatedPagesData } from '@/queries/sql/conversion-drop-insights/check-drop-correlated-pages';
import { resolveWebsiteId } from '@/app/chat/tools/conversion-drop-insights/check-total-conversion-drop';
/* eslint-disable no-console */

export interface CheckDropCorrelatedPagesTool {
  name: 'check-drop-correlated-pages';
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (params: any) => Promise<any>;
}

const inputSchema = z.object({
  websiteId: z.string().optional(),
  targetEvent: z
    .string()
    .describe('The conversion event to check for (e.g., "checkout_complete", "signup_complete")'),
  from: z.string().describe('Start of time range (YYYY-MM-DD)'),
  to: z.string().describe('End of time range (YYYY-MM-DD)'),
  lastPagesLimit: z
    .number()
    .min(1)
    .max(5)
    .default(1)
    .describe('How many last pages to extract per session (1-5)'),
});

export const checkDropCorrelatedPagesTool: CheckDropCorrelatedPagesTool = {
  name: 'check-drop-correlated-pages',
  description: `Identify which URL paths (pages) are most frequently visited immediately before users drop off from a funnel or conversion event. These "correlated pages" may be confusing, too long, broken, or poorly optimized.

This tool answers: "Which pages are most associated with users who don't convert?"

Key Features:
- Finds sessions where users did NOT complete the target conversion event
- Extracts the last N pages visited in those sessions
- Ranks pages by frequency of appearance in drop-off sessions
- Calculates percentage of drop sessions each page appears in
- Shows average position from end of session for each page

Common Use Cases:
- Diagnosing drop-off patterns during checkout flows
- Identifying confusing pages in user onboarding
- Finding friction points in lead generation funnels
- Optimizing pages that frequently cause user abandonment

The tool helps identify pages that may need redesign, content improvement, or removal to reduce conversion drop-offs.`,
  inputSchema,
  execute: async (params: z.infer<typeof inputSchema>) => {
    try {
      // Validate input
      const validatedParams = inputSchema.parse(params);

      // Resolve website ID
      const websiteId = await resolveWebsiteId(validatedParams.websiteId);

      // Validate date formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(validatedParams.from) || !dateRegex.test(validatedParams.to)) {
        throw new Error('Dates must be in YYYY-MM-DD format');
      }

      // Validate target event
      if (!validatedParams.targetEvent || validatedParams.targetEvent.trim() === '') {
        throw new Error('Target event must be specified');
      }

      console.log('[check-drop-correlated-pages] Executing with params:', validatedParams);
      console.log('[check-drop-correlated-pages] Resolved website ID:', websiteId);
      console.log('[check-drop-correlated-pages] Target event:', validatedParams.targetEvent);

      // Get drop correlated pages data
      const result = await getDropCorrelatedPagesData(
        websiteId,
        validatedParams.targetEvent,
        validatedParams.from,
        validatedParams.to,
        validatedParams.lastPagesLimit,
      );

      console.log('[check-drop-correlated-pages] Tool execution completed successfully');
      console.log('[check-drop-correlated-pages] Result count:', result.length, 'pages');

      // Calculate summary metrics
      const totalDropSessions = result.reduce((sum, page) => sum + page.dropSessions, 0);
      const avgPercentage =
        result.length > 0
          ? result.reduce((sum, page) => sum + page.percentageOfDropSessions, 0) / result.length
          : 0;
      const avgPosition =
        result.length > 0
          ? result.reduce((sum, page) => sum + page.avgPositionFromEnd, 0) / result.length
          : 0;

      // Find the page with the highest drop correlation
      const pageWithHighestCorrelation = result.length > 0 ? result[0] : null;

      return {
        data: result,
        summary: {
          totalPagesAnalyzed: result.length,
          totalDropSessions,
          averagePercentageOfDropSessions: avgPercentage,
          averagePositionFromEnd: avgPosition,
          pageWithHighestCorrelation: pageWithHighestCorrelation?.path || 'N/A',
          highestCorrelationPercentage: pageWithHighestCorrelation?.percentageOfDropSessions || 0,
        },
        metadata: {
          websiteId,
          targetEvent: validatedParams.targetEvent,
          dateRange: `${validatedParams.from} to ${validatedParams.to}`,
          lastPagesLimit: validatedParams.lastPagesLimit,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[check-drop-correlated-pages] Tool execution failed:', error);
      throw new Error(`Failed to check drop correlated pages: ${error.message}`);
    }
  },
};
