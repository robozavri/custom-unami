import { z } from 'zod';
import { getSignupConversionRate } from '@/queries/sql/events/getSignupConversionRate';

export const getSignupConversionRateTool = {
  name: 'get_signup_conversion_rate',
  description:
    'Calculate the ratio of signups vs visits to measure user acquisition conversion rate',
  inputSchema: z.object({
    websiteId: z.string().describe('Website ID to analyze'),
    startDate: z.string().optional().describe('Start date (ISO string, defaults to 7 days ago)'),
    endDate: z.string().optional().describe('End date (ISO string, defaults to now)'),
    signupEventName: z.string().optional().describe('Name of signup event (defaults to "signup")'),
  }),
  execute: async ({ websiteId, startDate, endDate, signupEventName }) => {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await getSignupConversionRate(
      websiteId,
      start,
      end,
      signupEventName || 'signup',
    );

    return {
      success: true,
      data: {
        websiteId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        metrics: {
          totalVisits: result.totalVisits,
          totalSignups: result.totalSignups,
          conversionRate: `${result.conversionRate.toFixed(2)}%`,
          ratio: `${result.totalSignups}:${result.totalVisits}`,
        },
        breakdown: {
          visits: {
            pageviews: result.breakdown.visits.pageviews,
            uniqueVisitors: result.breakdown.visits.uniqueVisitors,
          },
          signups: {
            total: result.breakdown.signups.total,
            uniqueUsers: result.breakdown.signups.uniqueUsers,
          },
        },
        analysis: {
          question: 'What is the ratio of "signups" vs "visits"?',
          answer: `During the analyzed period, there were ${
            result.totalVisits
          } total visits (pageviews) and ${
            result.totalSignups
          } signups. The conversion rate is ${result.conversionRate.toFixed(
            2,
          )}%, meaning for every 100 visits, ${result.conversionRate.toFixed(
            1,
          )} resulted in a signup.`,
          interpretation:
            result.conversionRate > 5
              ? 'High conversion rate - excellent user acquisition performance!'
              : result.conversionRate > 2
              ? 'Good conversion rate - room for optimization'
              : 'Low conversion rate - consider improving signup flow and user experience',
        },
      },
    };
  },
};
