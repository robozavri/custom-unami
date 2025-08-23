import { z } from 'zod';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getAverageEventsPerSession } from '@/queries/sql/events/getAverageEventsPerSession';
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

export const getAverageEventsPerSessionTool = {
  name: 'get-average-events-per-session',
  description: `
- Get the average number of events per session for a website.
- Answers the question: "What is the average number of events per session?"
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event, if not provided shows all events)
  - timezone (string, optional)
- Returns the average events per session with detailed breakdown and statistics.
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

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Database-agnostic query execution
    const result = await getAverageEventsPerSession(websiteId, startDate, endDate, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      summary: {
        average_events_per_session: Number(result.averageEventsPerSession.toFixed(2)),
        total_sessions: result.totalSessions,
        total_events: result.totalEvents,
      },
      breakdown: result.breakdown.map(item => ({
        events_per_session: item.eventCount,
        session_count: item.sessionCount,
        percentage: Number(item.percentage.toFixed(1)),
      })),
      analysis: {
        question: 'What is the average number of events per session?',
        answer: `The average number of events per session is ${result.averageEventsPerSession.toFixed(
          2,
        )}. This is calculated from ${result.totalEvents} total events across ${
          result.totalSessions
        } unique sessions.`,
        insights: [
          `Most sessions have ${result.breakdown[0]?.eventCount || 0} events`,
          `${
            result.breakdown[0]?.percentage.toFixed(1) || 0
          }% of sessions are single-event sessions`,
          `The distribution shows how engaged users are with your website`,
        ],
      },
    };
  },
};

export type GetAverageEventsPerSessionTool = typeof getAverageEventsPerSessionTool;
