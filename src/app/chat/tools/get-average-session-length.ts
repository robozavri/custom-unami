import { z } from 'zod';
import { getAverageSessionLengthBuckets } from '@/queries';
import { getWebsiteId } from '../state';

const inputSchema = z.object({
  websiteId: z.string().optional(),
  period: z.object({
    granularity: z.enum(['day', 'week', 'month']).default('day'),
    start: z.string(),
    end: z.string(),
  }),
  include_bounces: z.boolean().optional().default(true),
  timezone: z.string().optional().default('UTC'),
});

export type Input = z.infer<typeof inputSchema>;

export interface AvgSessionRow {
  period_start: string;
  period_end: string;
  sessions: number;
  total_duration_s: number;
  avg_session_length_s: number;
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

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
}

export const getAverageSessionLengthTool = {
  name: 'get-average-session-length',
  description:
    'Compute average session length per period bucket (day/week/month) from pageview events, optionally excluding bounces.',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: AvgSessionRow[] }> => {
    const input = inputSchema.parse(raw);
    const websiteId = await resolveWebsiteId(input.websiteId);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    const rows = await getAverageSessionLengthBuckets({
      websiteId,
      granularity: input.period.granularity,
      date_from: input.period.start,
      date_to: input.period.end,
      include_bounces: input.include_bounces,
      timezone: input.timezone,
    });

    const data: AvgSessionRow[] = rows.map(r => {
      const start = new Date(`${r.bucket_start}T00:00:00.000Z`);
      const end = addDays(start, 1);
      const sessions = Number(r.sessions ?? 0n);
      const total = Number(r.total_duration_s ?? 0n);
      const avg = sessions > 0 ? Number((total / sessions).toFixed(2)) : 0;
      return {
        period_start: toDateOnly(start),
        period_end: toDateOnly(new Date(end.getTime() - 1)),
        sessions,
        total_duration_s: total,
        avg_session_length_s: avg,
      };
    });

    return { data };
  },
};

export type GetAverageSessionLengthTool = typeof getAverageSessionLengthTool;
