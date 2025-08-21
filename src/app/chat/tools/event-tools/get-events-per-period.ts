import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getEventsPerPeriod } from '@/queries/sql/events/getEventsPerPeriod';
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
  granularity: z.enum(['day', 'week', 'month']).default('day'),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getEventsPerPeriodTool = {
  name: 'get-events-per-period',
  description: `
- Get events count grouped by time periods (daily/weekly/monthly).
- Shows how many events occurred in each time bucket.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - granularity (day/week/month, default day)
  - timezone (string, optional)
- Returns events count and unique users per time period.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
      granularity,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Database-agnostic query execution
    const result = await getEventsPerPeriod(websiteId, startDate, endDate, granularity, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      granularity,
      periods: result.periods,
    };
  },
};

export type GetEventsPerPeriodTool = typeof getEventsPerPeriodTool;
