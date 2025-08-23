import { z } from 'zod';
import { parseISO, subDays, formatISO } from 'date-fns';
import { getNewUserFirstDayEventRate } from '@/queries/sql/events/getNewUserFirstDayEventRate';
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
});

type Params = z.infer<typeof paramsSchema>;

export const getNewUserFirstDayEventRateTool = {
  name: 'get-new-user-first-day-event-rate',
  description:
    'What % of new users do event X on the first day? If event_name omitted, counts any custom event.',
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await getWebsiteId(websiteIdInput);

    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    const result = await getNewUserFirstDayEventRate(websiteId, startDate, endDate, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'any_custom_event',
      total_sessions: result.totalSessions,
      sessions_with_event_on_first_day: result.sessionsWithEventOnFirstDay,
      percentage: Number(result.percentage.toFixed(2)),
      analysis: {
        question: 'What % of new users do event X on the first day?',
        answer: `${result.percentage.toFixed(2)}% of new user sessions performed ${
          event_name || 'a custom event'
        } on day 0 (first day).`,
      },
    };
  },
};

export type GetNewUserFirstDayEventRateTool = typeof getNewUserFirstDayEventRateTool;
