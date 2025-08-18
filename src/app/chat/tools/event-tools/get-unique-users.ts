import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getUniqueUsers } from '@/queries/sql/events/getUniqueUsers';

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

export const getUniqueUsersTool = {
  name: 'get-unique-users',
  description: `
- Get the count of unique users who triggered custom events.
- Returns the number of distinct sessions that had custom events.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, optional; filter by specific event)
  - timezone (string, optional)
- Returns the unique users count with date range information.
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
    const result = await getUniqueUsers(websiteId, startDate, endDate, event_name);

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      filter: event_name || 'all_events',
      unique_users: result.uniqueUsers,
    };
  },
};

export type GetUniqueUsersTool = typeof getUniqueUsersTool;
