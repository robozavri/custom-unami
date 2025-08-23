import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getEventConversionFunnel } from '@/queries/sql/events/getEventConversionFunnel';
import { getWebsiteId } from '../../state';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

const paramsSchema = z.object({
  websiteId: z.string().optional(),
  days: z.number().int().positive().default(7),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  event_x: z.string().optional(),
  event_y: z.string().optional(),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getEventConversionFunnelTool = {
  name: 'get-event-conversion-funnel',
  description: `
- What percentage of users reached event Y after event X?
- If event_x or event_y is omitted: defaults to page_view → any custom event.
- Params: websiteId?, days?, date_from?, date_to?, event_x?, event_y?, timezone?
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_x,
      event_y,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await getWebsiteId(websiteIdInput);

    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    const result = await getEventConversionFunnel(websiteId, startDate, endDate, event_x, event_y);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      from_event: event_x || 'page_view',
      to_event: event_y || 'any_custom_event',
      summary: {
        started_sessions: result.startedSessions,
        converted_sessions: result.convertedSessions,
        conversion_rate: Number(result.conversionRate.toFixed(2)),
      },
      analysis: {
        question: 'What percentage of users reached event Y after event X?',
        answer: `${result.conversionRate.toFixed(2)}% of sessions that had ${
          event_x || 'page_view'
        } also had ${event_y || 'a custom event'} later in the session.`,
      },
    };
  },
};

export type GetEventConversionFunnelTool = typeof getEventConversionFunnelTool;
