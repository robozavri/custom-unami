import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getTotalEventCount } from '@/queries/sql/events/getTotalEventCount';

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
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getTotalEventCountTool = {
  name: 'get-total-event-count',
  description: `
- Get the total count of custom events for a website.
- Returns the absolute number of events that occurred in the specified time period.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - timezone (string, optional)
- Returns the total event count with date range information.
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
    const result = await getTotalEventCount(websiteId, startDate, endDate, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      total_event_count: result.totalEventCount,
    };
  },
};

export type GetTotalEventCountTool = typeof getTotalEventCountTool;
