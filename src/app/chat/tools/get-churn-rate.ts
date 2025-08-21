import { z } from 'zod';
// import debug from 'debug';
import { getUserEventsForChurn } from '@/queries';
import { getWebsiteId } from '../state';

type Granularity = 'day' | 'week' | 'month';

export const inputSchema = z.object({
  websiteId: z.string().optional(),
  period: z.object({
    granularity: z.enum(['day', 'week', 'month']).default('month'),
    start: z.string(),
    end: z.string(),
  }),
  churn_model: z.enum(['inactivity', 'cancellation']).default('inactivity'),
  inactivity_days: z.number().int().positive().optional().default(28),
  timezone: z.string().optional().default('UTC'),
});

export type Input = z.infer<typeof inputSchema>;

export interface ChurnRow {
  period_start: string;
  period_end: string;
  at_risk: number;
  churned: number;
  churn_rate: number; // 0..100
}

async function resolveWebsiteId(websiteIdInput?: string): Promise<string> {
  return getWebsiteId(websiteIdInput);
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

function startOfWeekUTC(d: Date): Date {
  // ISO week: Monday as start
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = nd.getUTCDay(); // 0..6, Sun=0
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  return addDays(nd, diff);
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function makeBuckets(
  startISO: string,
  endISO: string,
  granularity: Granularity,
): Array<{ start: Date; end: Date }> {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const buckets: Array<{ start: Date; end: Date }> = [];

  if (granularity === 'day') {
    let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (cur <= endDay) {
      const next = addDays(cur, 1);
      buckets.push({ start: cur, end: next });
      cur = next;
    }
  } else if (granularity === 'week') {
    let cur = startOfWeekUTC(start);
    const stop = addDays(end, 1); // inclusive end -> closed-open buckets
    while (cur < stop) {
      const next = addDays(cur, 7);
      buckets.push({ start: cur, end: next });
      cur = next;
    }
  } else {
    // month
    let cur = startOfMonthUTC(start);
    const stop = endOfMonthUTC(end);
    while (cur < stop) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      buckets.push({ start: cur, end: next });
      cur = next;
    }
  }

  return buckets.filter(b => b.start < b.end);
}

export const getChurnRateTool = {
  name: 'get-churn-rate',
  description:
    'Compute churn rate per period bucket (day/week/month). Supports inactivity-based churn. Returns [{ period_start, period_end, at_risk, churned, churn_rate }].',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: ChurnRow[]; meta: any }> => {
    const input = inputSchema.parse(raw);
    const websiteId = await resolveWebsiteId(input.websiteId);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    if (input.churn_model === 'cancellation') {
      throw new Error(
        'churn_model=cancellation is not supported yet for this schema. Use inactivity model.',
      );
    }

    const buckets = makeBuckets(input.period.start, input.period.end, input.period.granularity);

    // Fetch events with user (session) creation timestamps within the overall window
    const rows = await getUserEventsForChurn({
      websiteId,
      date_from: input.period.start,
      date_to: input.period.end,
    });

    // Group by user (session_id)
    type UserEvents = { userCreatedAt: Date | null; events: Date[] };
    const byUser = new Map<string, UserEvents>();
    for (const r of rows) {
      const sessionId = String((r as any).session_id);
      const userCreatedAt = (r as any).user_created_at
        ? new Date(String((r as any).user_created_at))
        : null;
      const eventTime = new Date(String((r as any).event_time));
      const e = byUser.get(sessionId) ?? { userCreatedAt, events: [] };
      if (e.userCreatedAt === null && userCreatedAt) e.userCreatedAt = userCreatedAt;
      e.events.push(eventTime);
      byUser.set(sessionId, e);
    }

    // Pre-sort event times for each user
    for (const ue of byUser.values()) {
      ue.events.sort((a, b) => a.getTime() - b.getTime());
    }

    const inactivityDays = input.inactivity_days ?? 28;
    const data: ChurnRow[] = [];

    for (const { start, end } of buckets) {
      const period_start = toDateOnly(start);
      const period_end = toDateOnly(new Date(end.getTime() - 1));

      let atRisk = 0;
      let churned = 0;

      for (const ue of byUser.values()) {
        const createdAt = ue.userCreatedAt ?? (ue.events.length ? ue.events[0] : null);
        if (!createdAt) continue;
        if (createdAt >= start) continue; // not at-risk yet

        atRisk += 1;

        // last_seen up to bucket_end
        let lastSeen: Date | null = null;
        const times = ue.events;
        // binary search latest <= end
        let lo = 0,
          hi = times.length - 1,
          best = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (times[mid] < end) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (best >= 0) lastSeen = times[best];

        if (!lastSeen || lastSeen < start) {
          // churn if last_seen + inactivity_days ∈ [start, end)
          const churnMoment = lastSeen
            ? addDays(lastSeen, inactivityDays)
            : addDays(createdAt, inactivityDays);
          if (churnMoment >= start && churnMoment < end) {
            churned += 1;
          }
        }
      }

      const churn_rate = atRisk > 0 ? (churned / atRisk) * 100 : 0;
      data.push({
        period_start,
        period_end,
        at_risk: atRisk,
        churned,
        churn_rate: Number(churn_rate.toFixed(2)),
      });
    }

    return {
      data,
      meta: {
        websiteId,
        model: input.churn_model,
        inactivity_days: inactivityDays,
        buckets: buckets.length,
      },
    };
  },
};

export type GetChurnRateTool = typeof getChurnRateTool;
