import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getReturningEventUsers } from '@/queries/sql/events/getReturningEventUsers';

function toDateOnly(date: Date) {
  return formatISO(date, { representation: 'date' });
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string | null> {
  if (websiteIdInput) return websiteIdInput;
  const active = getActiveWebsiteId();
  if (active) return active;
  if (DEFAULT_WEBSITE_ID) return DEFAULT_WEBSITE_ID;

  const first = await prisma.client.website.findFirst({
    where: { deletedAt: null },
    select: { id: true },
  });
  if (first?.id) {
    setActiveWebsiteId(first.id);
    return first.id;
  }
  return null;
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

export const getReturningEventUsersTool = {
  name: 'get-returning-event-users',
  description: `
- Get returning users analysis for events over time periods.
- Shows how many users return to perform the same event in subsequent periods.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - granularity (day/week/month, default day)
  - timezone (string, optional)
- Returns total users, returning users, and returning rate per time period.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    // console.log('[get-returning-event-users] Raw params received:', rawParams);

    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
      granularity,
    } = paramsSchema.parse(rawParams as Params);

    // console.log('[get-returning-event-users] Parsed params:', {
    //   websiteId: websiteIdInput,
    //   days,
    //   date_from,
    //   date_to,
    //   event_name,
    //   granularity,
    // });

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) {
      throw new Error(
        'websiteId is required. Set an active website with set-active-website or configure DEFAULT_WEBSITE_ID.',
      );
    }

    // console.log('[get-returning-event-users] Resolved websiteId:', websiteId);

    // Determine date range
    const today = new Date();
    let endDate: Date;
    let startDate: Date;

    if (date_from && date_to) {
      // Use explicit date range if provided
      startDate = parseISO(date_from);
      endDate = parseISO(date_to);
    } else {
      // Fall back to days calculation
      endDate = today;
      startDate = subDays(endDate, Math.max(1, days) - 1);
    }

    // console.log('[get-returning-event-users] Date range:', {
    //   today: today.toISOString(),
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    //   days,
    // });

    // console.log('[get-returning-event-users] Calling SQL query with params:', {
    //   websiteId,
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    //   granularity,
    //   eventName: event_name,
    // });

    // First, let's check if there are any events at all in this website
    // const checkQuery = `
    //   SELECT COUNT(*) as total_events
    //   FROM website_event
    //   WHERE website_id = {{websiteId::uuid}} AND event_type = {{eventType}}
    // `;

    // try {
    //   const { rawQuery } = prisma;
    //   const totalEvents = await rawQuery(checkQuery, { websiteId, eventType: 2 }); // 2 = EVENT_TYPE.customEvent
    //   // console.log(
    //   //   '[get-returning-event-users] Total events in website:',
    //   //   totalEvents[0]?.total_events || 0,
    //   // );

    //   // Also check for events in the last 30 days to see if there's recent data
    //   const recentCheckQuery = `
    //     SELECT COUNT(*) as recent_events
    //     FROM website_event
    //     WHERE website_id = {{websiteId::uuid}}
    //     AND event_type = {{eventType}}
    //     AND created_at >= NOW() - INTERVAL '30 days'
    //   `;

    //   const recentEvents = await rawQuery(recentCheckQuery, { websiteId, eventType: 2 });
    //   // console.log(
    //   //   '[get-returning-event-users] Recent events (last 30 days):',
    //   //   recentEvents[0]?.recent_events || 0,
    //   // );

    //   // Check for events in the requested date range
    //   const rangeCheckQuery = `
    //     SELECT COUNT(*) as range_events
    //     FROM website_event
    //     WHERE website_id = {{websiteId::uuid}}
    //     AND event_type = {{eventType}}
    //     AND created_at BETWEEN {{startDate}} AND {{endDate}}
    //   `;

    //   const rangeEvents = await rawQuery(rangeCheckQuery, {
    //     websiteId,
    //     eventType: 2,
    //     startDate,
    //     endDate,
    //   });
    //   // console.log(
    //   //   '[get-returning-event-users] Events in requested range:',
    //   //   rangeEvents[0]?.range_events || 0,
    //   // );
    // } catch (error) {
    //   // console.log('[get-returning-event-users] Error checking total events:', error);
    // }

    // Database-agnostic query execution
    const result = await getReturningEventUsers(
      websiteId,
      startDate,
      endDate,
      granularity,
      event_name,
    );

    // console.log('[get-returning-event-users] SQL query result:', {
    //   resultType: typeof result,
    //   hasPeriods: !!result?.periods,
    //   periodsCount: result?.periods?.length || 0,
    //   periods: result?.periods,
    // });

    const response = {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      granularity,
      periods: result.periods,
    };

    // console.log('[get-returning-event-users] Final response:', response);

    return response;
  },
};

export type GetReturningEventUsersTool = typeof getReturningEventUsersTool;
