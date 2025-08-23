import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getEventFrequencyDistribution } from '@/queries/sql/events/getEventFrequencyDistribution';
import { getWebsiteId } from '../../state';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  days: z.number().int().positive().default(7),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  event_name: z.string().optional(),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getEventFrequencyDistributionTool = {
  name: 'get-event-frequency-distribution',
  description: `
- Get the distribution of how many users performed events once vs multiple times.
- Answers the question: "How many users performed the event once and how many multiple times?"
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event, if not provided shows all events)
  - timezone (string, optional)
- Returns breakdown of users by event frequency (once vs multiple times).
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Database-agnostic query execution
    const result = await getEventFrequencyDistribution(
      websiteId,
      startDate,
      endDate,
      event_name,
      undefined,
    );

    // Calculate percentages
    const oneEventPercentage =
      result.totalUniqueUsers > 0
        ? ((result.usersWithOneEvent / result.totalUniqueUsers) * 100).toFixed(1)
        : '0.0';
    const multipleEventsPercentage =
      result.totalUniqueUsers > 0
        ? ((result.usersWithMultipleEvents / result.totalUniqueUsers) * 100).toFixed(1)
        : '0.0';

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      summary: {
        users_with_one_event: result.usersWithOneEvent,
        users_with_multiple_events: result.usersWithMultipleEvents,
        total_unique_users: result.totalUniqueUsers,
      },
      percentages: {
        one_event: `${oneEventPercentage}%`,
        multiple_events: `${multipleEventsPercentage}%`,
      },
      breakdown: result.breakdown,
      analysis: {
        question: 'How many users performed the event once and how many multiple times?',
        answer: `${result.usersWithOneEvent} users (${oneEventPercentage}%) performed the event once, while ${result.usersWithMultipleEvents} users (${multipleEventsPercentage}%) performed it multiple times.`,
        total_users: result.totalUniqueUsers,
      },
    };
  },
};

export type GetEventFrequencyDistributionTool = typeof getEventFrequencyDistributionTool;
