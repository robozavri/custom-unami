import { z } from 'zod';
import { getEventDropChainData } from '@/queries/sql/conversion-drop-insights/check-event-drop-chain';
import { resolveWebsiteId } from '@/app/chat/tools/conversion-drop-insights/check-total-conversion-drop';
/* eslint-disable no-console */
export interface CheckEventDropChainTool {
  name: 'check-event-drop-chain';
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (params: any) => Promise<any>;
}

const inputSchema = z.object({
  websiteId: z.string().optional(),
  steps: z
    .array(z.string())
    .min(2)
    .describe('Ordered list of event names to treat as funnel steps'),
  from: z.string().describe('Start of time range (YYYY-MM-DD)'),
  to: z.string().describe('End of time range (YYYY-MM-DD)'),
  distinctBy: z
    .enum(['session_id', 'visitor_id'])
    .default('session_id')
    .describe('Whether to group users by session or visitor'),
});

export const checkEventDropChainTool: CheckEventDropChainTool = {
  name: 'check-event-drop-chain',
  description: `Analyze how users drop off across a sequence of predefined events (a funnel). For each step in the chain, calculate how many users completed it and what percentage dropped off before reaching the next step.

This tool answers: "Where are users dropping off in my funnel or event chain?"

Key Features:
- Supports any length of funnel (2+ steps)
- Tracks user progression through sequential events
- Calculates drop-off rates between each step
- Identifies the biggest conversion bottlenecks
- Works with both session-based and visitor-based tracking

Common Use Cases:
- E-commerce checkout funnels
- User onboarding flows
- Feature adoption sequences
- Lead generation processes
- Subscription signup flows

The tool ensures users must complete all previous steps before being counted in subsequent steps, providing accurate funnel analysis.`,
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

      // Validate steps array
      if (!validatedParams.steps || validatedParams.steps.length < 2) {
        throw new Error('At least 2 steps must be specified for funnel analysis');
      }

      // Check for duplicate steps
      const uniqueSteps = new Set(validatedParams.steps);
      if (uniqueSteps.size !== validatedParams.steps.length) {
        throw new Error('Duplicate steps are not allowed in the funnel');
      }

      console.log('[check-event-drop-chain] Executing with params:', validatedParams);
      console.log('[check-event-drop-chain] Resolved website ID:', websiteId);
      console.log('[check-event-drop-chain] Funnel steps:', validatedParams.steps);

      // Get event drop chain data
      const result = await getEventDropChainData(
        websiteId,
        validatedParams.steps,
        validatedParams.from,
        validatedParams.to,
        validatedParams.distinctBy,
      );

      console.log('[check-event-drop-chain] Tool execution completed successfully');
      console.log('[check-event-drop-chain] Result count:', result.length, 'steps');

      // Calculate summary metrics
      const totalUsers = result[0]?.users || 0;
      const finalStepUsers = result[result.length - 1]?.users || 0;
      const overallConversionRate = totalUsers > 0 ? (finalStepUsers / totalUsers) * 100 : 0;
      const totalDropOff = totalUsers - finalStepUsers;

      // Find the step with the highest drop-off rate
      const stepWithHighestDropOff = result
        .filter(step => step.dropRate !== null)
        .reduce((max, step) => (step.dropRate! > max.dropRate! ? step : max), {
          step: '',
          dropRate: 0,
        });

      return {
        data: result,
        summary: {
          totalSteps: result.length,
          totalUsersStarted: totalUsers,
          totalUsersCompleted: finalStepUsers,
          overallConversionRate,
          totalDropOff,
          stepWithHighestDropOff: stepWithHighestDropOff.step || 'N/A',
          highestDropOffRate: stepWithHighestDropOff.dropRate || 0,
        },
        metadata: {
          websiteId,
          steps: validatedParams.steps,
          dateRange: `${validatedParams.from} to ${validatedParams.to}`,
          distinctBy: validatedParams.distinctBy,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[check-event-drop-chain] Tool execution failed:', error);
      throw new Error(`Failed to check event drop chain: ${error.message}`);
    }
  },
};
