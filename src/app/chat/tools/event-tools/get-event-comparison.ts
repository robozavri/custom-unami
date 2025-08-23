import { z } from 'zod';
import { getEventComparison } from '@/queries/sql/events/getEventComparison';

export const getEventComparisonTool = {
  name: 'get_event_comparison',
  description:
    'Compare the count of add_to_cart events vs checkout_success events to calculate conversion rate',
  inputSchema: z.object({
    websiteId: z.string().describe('Website ID to analyze'),
    startDate: z.string().optional().describe('Start date (ISO string, defaults to 7 days ago)'),
    endDate: z.string().optional().describe('End date (ISO string, defaults to now)'),
    addEventName: z
      .string()
      .optional()
      .describe('Name of add to cart event (defaults to "add_to_cart")'),
    checkoutEventName: z
      .string()
      .optional()
      .describe('Name of checkout success event (defaults to "checkout_success")'),
  }),
  execute: async ({ websiteId, startDate, endDate, addEventName, checkoutEventName }) => {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getEventComparison(
      websiteId,
      start,
      end,
      addEventName || 'add_to_cart',
      checkoutEventName || 'checkout_success',
    );

    return {
      success: true,
      data: {
        websiteId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        events: {
          addToCart: {
            name: addEventName || 'add_to_cart',
            count: result.addToCartCount,
          },
          checkout: {
            name: checkoutEventName || 'checkout_success',
            count: result.checkoutCount,
          },
        },
        metrics: {
          totalEvents: result.totalEvents,
          successRate: `${result.successRate.toFixed(2)}%`,
          conversionRatio: `${result.checkoutCount}:${result.addToCartCount}`,
        },
        analysis: {
          question: 'How many successful checkout events were there vs. add_to_cart events?',
          answer: `During the analyzed period, there were ${
            result.addToCartCount
          } add_to_cart events and ${
            result.checkoutCount
          } checkout_success events. The conversion rate is ${result.successRate.toFixed(2)}%.`,
        },
      },
    };
  },
};
