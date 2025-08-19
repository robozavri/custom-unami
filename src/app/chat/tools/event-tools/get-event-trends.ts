import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getSegmentedEvents } from '@/queries/sql/events/getSegmentedEvents';
import { getEventsPerPeriod } from '@/queries/sql/events/getEventsPerPeriod';
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
  segment_by: z.enum(['country', 'device', 'plan', 'browser']).default('device'),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getEventTrendsTool = {
  name: 'get-event-trends',
  description: `
- Get comprehensive event trends analysis combining three key metrics:
  1. Events per period - Shows event count over time
  2. Returning event users - Shows user retention patterns
  3. Segmented events - Shows event distribution by user properties
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - granularity (day/week/month, default day)
  - segment_by (country/device/plan/browser, default device)
  - timezone (string, optional)
- Returns comprehensive event trends analysis with all three metrics.
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
      segment_by,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) {
      throw new Error(
        'websiteId is required. Set an active website with set-active-website or configure DEFAULT_WEBSITE_ID.',
      );
    }

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Execute all three queries in parallel for better performance
    // eslint-disable-next-line no-console
    // console.log('🔍 [DEBUG] Starting parallel execution of three queries...');
    // eslint-disable-next-line no-console
    // console.log('🔍 [DEBUG] Parameters:', {
    //   websiteId,
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    //   granularity,
    //   event_name,
    //   segment_by,
    // });

    const [eventsPerPeriodResult, returningUsersResult, segmentedEventsResult] = await Promise.all([
      getEventsPerPeriod(websiteId, startDate, endDate, granularity, event_name),
      getReturningEventUsers(websiteId, startDate, endDate, granularity, event_name),
      getSegmentedEvents(websiteId, startDate, endDate, segment_by, event_name),
    ]);
    // eslint-disable-next-line no-console
    // console.log('************************');
    // eslint-disable-next-line no-console
    // console.log('About to call getSegmentedEvents with params:', {
    //   websiteId,
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    //   segment_by,
    //   event_name,
    // });

    // try {
    //   // eslint-disable-next-line no-console
    //   // console.log('Calling getSegmentedEvents...');
    //   // const result = await getSegmentedEvents(
    //   //   websiteId,
    //   //   startDate,
    //   //   endDate,
    //   //   segment_by,
    //   //   event_name,
    //   // );
    //   // eslint-disable-next-line no-console
    //   // console.log('getSegmentedEvents completed successfully!');
    //   // eslint-disable-next-line no-console
    //   // console.log('Result type:', typeof result);
    //   // eslint-disable-next-line no-console
    //   // console.log('Result:', result);
    //   // eslint-disable-next-line no-console
    //   // console.log('************************');
    // } catch (error) {
    //   // eslint-disable-next-line no-console
    //   console.error('ERROR in getSegmentedEvents:', error);
    //   // eslint-disable-next-line no-console
    //   console.error('Error details:', String(error));
    //   throw error;
    // }
    // console.log('segmentedEventsResult', segmentedEventsResult);
    // eslint-disable-next-line no-console
    // console.log('🔍 [DEBUG] getEventsPerPeriod result:', {
    //   type: typeof eventsPerPeriodResult,
    //   hasPeriods: !!eventsPerPeriodResult?.periods,
    //   periodsLength: eventsPerPeriodResult?.periods?.length,
    //   result: eventsPerPeriodResult,
    // });

    // eslint-disable-next-line no-console
    // console.log('🔍 [DEBUG] getReturningEventUsers result:', {
    //   type: typeof returningUsersResult,
    //   // hasPeriods: !!returningUsersResult?.periods,
    //   periodsLength: returningUsersResult?.periods?.length,
    //   result: returningUsersResult,
    // });

    // eslint-disable-next-line no-console
    // console.log('🔍 [DEBUG] getSegmentedEvents result:', {
    //   type: typeof segmentedEventsResult,
    //   hasSegments: !!segmentedEventsResult?.segments,
    //   segmentsLength: segmentedEventsResult?.segments?.length,
    //   result: segmentedEventsResult,
    // });

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      granularity,
      segment_by,
      analysis: {
        events_per_period: {
          description: 'Events count and unique users per time period',
          periods: eventsPerPeriodResult.periods,
        },
        returning_users: {
          description: 'User retention and returning user analysis',
          periods: returningUsersResult.periods,
        },
        segmented_events: {
          description: `Events distribution by ${segment_by}`,
          segments: segmentedEventsResult.segments,
        },
      },
      summary: {
        total_periods: eventsPerPeriodResult.periods.length,
        total_segments: segmentedEventsResult.segments.length,
        date_range: `${toDateOnly(startDate)} to ${toDateOnly(endDate)}`,
      },
    };
  },
};

export type GetEventTrendsTool = typeof getEventTrendsTool;
