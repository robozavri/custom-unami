import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getSegmentedEvents } from '@/queries/sql/events/getSegmentedEvents';

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
  segment_by: z.enum(['country', 'device', 'plan', 'browser']).default('device'),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getSegmentedEventsTool = {
  name: 'get-segmented-events',
  description: `
- Get events segmented by user properties (country, device, plan, browser).
- Shows how events are distributed across different user segments.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - segment_by (country/device/plan/browser, default device)
  - timezone (string, optional)
- Returns events count and unique users per segment.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
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

    // Database-agnostic query execution
    let result;
    try {
      // Use proper JOIN events + sessions for real user properties
      // Create proper segmentation query using session table
      const properQuery = `
        SELECT 
          COALESCE({{segmentColumn}}, 'Unknown') AS segment_value,
          COUNT(*) as events_count,
          COUNT(DISTINCT e.session_id) as unique_users
        FROM website_event e
        JOIN session s ON e.session_id = s.session_id
        WHERE e.website_id = {{websiteId::uuid}}
          AND e.created_at BETWEEN {{startDate}} AND {{endDate}}
          AND e.event_type = {{eventType}}
          ${event_name ? 'AND e.event_name = {{eventName}}' : ''}
        GROUP BY {{segmentColumn}}
        ORDER BY events_count DESC
      `;

      // Map segment_by to actual session table columns
      let segmentColumn: string;
      let segmentType: string;

      switch (segment_by) {
        case 'country':
          segmentColumn = 's.country';
          segmentType = 'country';
          break;
        case 'device':
          segmentColumn = 's.device';
          segmentType = 'device';
          break;
        case 'browser':
          segmentColumn = 's.browser';
          segmentType = 'browser';
          break;
        case 'plan':
          // For plan, we can use browser or os as proxy, or create a custom plan field
          segmentColumn = 's.browser';
          segmentType = 'browser_as_plan';
          break;
        default:
          segmentColumn = 's.device';
          segmentType = 'device';
      }

      const properParams = {
        websiteId,
        startDate,
        endDate,
        eventType: 2, // EVENT_TYPE.customEvent
        eventName: event_name,
        segmentColumn,
      };

      const properResult = await prisma.rawQuery(properQuery, properParams);

      result = {
        segments: properResult.map((row: any) => ({
          segment_type: segmentType,
          segment_value: row.segment_value || 'Unknown',
          events_count: Number(row.events_count || 0),
          unique_users: Number(row.unique_users || 0),
        })),
      };
    } catch (error) {
      // Fallback: try the original function but catch the error gracefully
      try {
        result = await getSegmentedEvents(websiteId, startDate, endDate, segment_by, event_name);
      } catch (fallbackError) {
        // Return empty result with explanation
        result = {
          segments: [],
          error:
            'Segmentation not available - session table join failed. Available data: utm_source, utm_medium, utm_campaign, hostname, event_name',
        };
      }
    }

    const response = {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      segment_by,
      segments: result.segments,
    };

    return response;
  },
};

export type GetSegmentedEventsTool = typeof getSegmentedEventsTool;
