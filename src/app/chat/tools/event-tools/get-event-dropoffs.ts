import { z } from 'zod';
import { parseISO, subDays, formatISO } from 'date-fns';
import { getEventDropoffs } from '@/queries/sql/events/getEventDropoffs';
import { getWebsiteId } from '../../state';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  days: z.number().int().positive().default(7),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  event_name: z.string().optional(),
  limit: z.number().int().positive().max(100).default(10),
});

type Params = z.infer<typeof paramsSchema>;

export const getEventDropoffsTool = {
  name: 'get-event-dropoffs',
  description:
    'Which events have the most drop-offs? Optionally filter by event_name; defaults to all events.',
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
      limit,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await getWebsiteId(websiteIdInput);

    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    const result = await getEventDropoffs(websiteId, startDate, endDate, event_name, limit);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      items: result.items.map(item => ({
        event_name: item.eventName,
        sessions_with_event: item.sessionsWithEvent,
        dropoff_sessions: item.dropoffSessions,
        dropoff_rate: Number(item.dropoffRate.toFixed(2)),
      })),
      insights: result.items
        .slice(0, 3)
        .map(i => `${i.eventName} has ${i.dropoffRate.toFixed(1)}% dropoff`),
    };
  },
};

export type GetEventDropoffsTool = typeof getEventDropoffsTool;
