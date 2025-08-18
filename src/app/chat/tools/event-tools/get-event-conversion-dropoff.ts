import { z } from 'zod';
import prisma from '@/lib/prisma';
import { DEFAULT_WEBSITE_ID } from '../../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { formatISO, parseISO, subDays } from 'date-fns';
import { getEventConversionDropoff } from '@/queries/sql/events/getEventConversionDropoff';

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
  event_name: z.string().describe('Main event to analyze for conversion'),
  next_event_name: z
    .string()
    .optional()
    .describe('Next event in the flow for drop-off calculation'),
  event_a: z.string().optional().describe('Event A for ratio calculation (A/B)'),
  event_b: z.string().optional().describe('Event B for ratio calculation (A/B)'),
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const getEventConversionDropoffTool = {
  name: 'get-event-conversion-dropoff',
  description: `
- Get event conversion rate, drop-off rate, and event ratio metrics.
- Combines conversion, drop-off, and ratio analysis in one result.
- Params:
  - websiteId (string, optional)
  - days (number, default 7)
  - date_from (YYYY-MM-DD, optional)
  - date_to (YYYY-MM-DD, optional)
  - event_name (string, required; main event to analyze)
  - next_event_name (string, optional; next event for drop-off calculation)
  - event_a (string, optional; event A for ratio calculation)
  - event_b (string, optional; event B for ratio calculation)
  - timezone (string, optional)
- Returns conversion rate, drop-off rate, and event ratio with detailed breakdown.
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const {
      websiteId: websiteIdInput,
      days,
      date_from,
      date_to,
      event_name,
      next_event_name,
      event_a,
      event_b,
    } = paramsSchema.parse(rawParams as Params);

    const websiteId = await resolveWebsiteId(websiteIdInput);
    if (!websiteId) {
      throw new Error(
        'websiteId is required. Set an active website with set-active-website or configure DEFAULT_WEBSITE_ID.',
      );
    }

    if (!event_name) {
      throw new Error('event_name is required for conversion analysis.');
    }

    // Determine date range
    const today = new Date();
    const endDate = date_to ? parseISO(date_to) : today;
    const startDate = date_from ? parseISO(date_from) : subDays(endDate, Math.max(1, days) - 1);

    // Database-agnostic query execution
    const result = await getEventConversionDropoff(
      websiteId,
      startDate,
      endDate,
      event_name,
      next_event_name,
      event_a,
      event_b,
    );

    return {
      days,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      main_event: event_name,
      next_event: next_event_name || 'not_specified',
      event_a: event_a || 'not_specified',
      event_b: event_b || 'not_specified',
      summary: {
        conversion_rate: result.summary.conversion_percentage,
        dropoff_rate: result.summary.dropoff_percentage,
        event_ratio: result.summary.ratio_value,
      },
      metrics: {
        total_users: result.totalUsers,
        users_with_main_event: result.usersWithEvent,
        users_with_next_event: result.usersWithNextEvent,
        event_a_count: result.eventACount,
        event_b_count: result.eventBCount,
      },
      calculations: {
        conversion_formula: `(${result.usersWithEvent} / ${result.totalUsers}) × 100 = ${result.summary.conversion_percentage}%`,
        dropoff_formula: next_event_name
          ? `(1 - ${result.usersWithNextEvent} / ${result.usersWithEvent}) × 100 = ${result.summary.dropoff_percentage}%`
          : 'Not calculated (next_event_name not provided)',
        ratio_formula:
          event_a && event_b
            ? `${result.eventACount} / ${result.eventBCount} = ${result.summary.ratio_value}`
            : 'Not calculated (event_a or event_b not provided)',
      },
    };
  },
};

export type GetEventConversionDropoffTool = typeof getEventConversionDropoffTool;
