import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getEventFrequencyPerUser } from '@/queries/sql/events/getEventFrequencyPerUser';
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

export const getEventFrequencyPerUserTool = {
  name: 'get-event-frequency-per-user',
  description: `
- Get the average number of events per user (event frequency).
- Calculates total events divided by unique users for engagement analysis.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - timezone (string, optional)
- Returns event frequency per user with supporting metrics.
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
    const result = await getEventFrequencyPerUser(websiteId, startDate, endDate, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      event_frequency_per_user: result.eventFrequencyPerUser,
      supporting_metrics: {
        total_event_count: result.totalEventCount,
        unique_users: result.uniqueUsers,
      },
      calculation: `Total Events (${result.totalEventCount}) ÷ Unique Users (${
        result.uniqueUsers
      }) = ${result.eventFrequencyPerUser.toFixed(2)}`,
    };
  },
};

export type GetEventFrequencyPerUserTool = typeof getEventFrequencyPerUserTool;
