import { z } from 'zod';
import { DEFAULT_WEBSITE_ID } from '../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import prisma from '@/lib/prisma';
import { getBounceRateBuckets } from '@/queries';

const inputSchema = z.object({
  websiteId: z.string().optional(),
  period: z.object({
    granularity: z.enum(['day', 'week', 'month']).default('day'),
    start: z.string(),
    end: z.string(),
  }),
  timezone: z.string().optional().default('UTC'),
});

export interface BounceRateOutputRow {
  period_start: string;
  period_end: string;
  sessions: number;
  bounces: number;
  bounce_rate: number;
}

function toDateOnly(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
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

export const getBounceRateTool = {
  name: 'get-bounce-rate',
  description:
    'Compute bounce rate per period bucket (day/week/month) using pageview-only definition (single page per visit = bounce).',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: BounceRateOutputRow[] }> => {
    const input = inputSchema.parse(raw);
    const websiteId = await resolveWebsiteId(input.websiteId);
    if (!websiteId) throw new Error('websiteId is required.');

    const rows = await getBounceRateBuckets({
      websiteId,
      granularity: input.period.granularity,
      date_from: input.period.start,
      date_to: input.period.end,
      timezone: input.timezone,
    });

    const data: BounceRateOutputRow[] = rows.map(r => {
      const start = new Date(`${r.bucket_start}T00:00:00.000Z`);
      const end = addDays(start, 1);
      const sessions = Number(r.visits ?? 0n);
      const bounces = Number(r.bounces ?? 0n);
      const bounce_rate = sessions > 0 ? Number(((bounces / sessions) * 100).toFixed(2)) : 0;
      return {
        period_start: toDateOnly(start),
        period_end: toDateOnly(new Date(end.getTime() - 1)),
        sessions,
        bounces,
        bounce_rate,
      };
    });

    return { data };
  },
};

export type GetBounceRateTool = typeof getBounceRateTool;
