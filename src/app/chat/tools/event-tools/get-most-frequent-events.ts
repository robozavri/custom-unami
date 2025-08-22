import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getMostFrequentEvents } from '@/queries/sql/events/getMostFrequentEvents';
import { getWebsiteId } from '../../state';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  days: z.number().int().positive().default(30),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().int().positive().max(100).default(10),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getMostFrequentEventsTool = {
  name: 'get-most-frequent-events',
  description: `
- Get the most frequently used events for a website.
- Returns events ranked by frequency with counts and percentages.
- Answers the question: "რომელი event-ებია ყველაზე ხშირად გამოყენებული?" (Which events are used most frequently?)
- Params:
  - websiteId (string, optional)
  - days (number, default 30)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - limit (number, default 10, max 100)
  - timezone (string, optional)
- Returns the most frequent events with counts, percentages, and date range information.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      limit,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Database-agnostic query execution
    const result = await getMostFrequentEvents(websiteId, startDate, endDate, limit);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      limit,
      total_events: result.totalEvents,
      period: result.period,
      most_frequent_events: result.events.map(event => ({
        event_name: event.eventName,
        event_count: event.eventCount,
        percentage: Math.round(event.percentage * 100) / 100, // Round to 2 decimal places
      })),
    };
  },
};

export type GetMostFrequentEventsTool = typeof getMostFrequentEventsTool;
