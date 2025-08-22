import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getUniqueButtonClickUsers } from '@/queries/sql/events/getUniqueButtonClickUsers';
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
  event_name: z.string().min(1, 'Event name is required'),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getUniqueButtonClickUsersTool = {
  name: 'get-unique-button-click-users',
  description: `
- Get the count of unique users who clicked a specific button/event.
- Returns both unique users count and total clicks for the specified event.
- Answers the question: "რამდენმა მომხმარებელმა დააჭირა კონკრეტულ ღილაკს?" (How many users clicked a specific button?)
- Params:
  - websiteId (string, optional)
  - days (number, default 30)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, required; the specific button/event to analyze)
  - timezone (string, optional)
- Returns unique users count, total clicks, and date range information.
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
    const result = await getUniqueButtonClickUsers(websiteId, startDate, endDate, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      event_name: result.eventName,
      unique_users: result.uniqueUsers,
      total_clicks: result.totalClicks,
      period: result.period,
      clicks_per_user:
        result.totalClicks > 0 ? (result.totalClicks / result.uniqueUsers).toFixed(2) : '0.00',
    };
  },
};

export type GetUniqueButtonClickUsersTool = typeof getUniqueButtonClickUsersTool;
