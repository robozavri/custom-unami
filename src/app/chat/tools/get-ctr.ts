import { z } from 'zod';
import { DEFAULT_WEBSITE_ID } from '../config';
import { getActiveWebsiteId, setActiveWebsiteId } from '../state';
import prisma from '@/lib/prisma';
import { getEventsForCtr } from '@/queries';

const inputSchema = z.object({
  websiteId: z.string().optional(),
  period: z.object({
    granularity: z.enum(['day', 'week', 'month']).default('day'),
    start: z.string(),
    end: z.string(),
  }),
  impression_events: z.array(z.string()).nonempty().default(['page_view']),
  click_events: z.array(z.string()).nonempty().default(['click']),
  breakdown: z
    .object({
      by: z
        .enum(['element_id', 'page_url', 'campaign_id', 'device', 'country', 'utm_source'])
        .nullable()
        .optional()
        .default(null),
    })
    .optional(),
  attribution: z
    .object({
      click_within_ms: z
        .number()
        .int()
        .positive()
        .optional()
        .default(30 * 60 * 1000),
      dedupe_clicks_ms: z.number().int().positive().optional().default(1000),
    })
    .optional(),
  uniqueness: z
    .object({
      mode: z.enum(['total', 'unique', 'both']).optional().default('both'),
    })
    .optional(),
  options: z
    .object({
      timezone: z.string().optional().default('UTC'),
      treat_route_change_as_view: z.boolean().optional().default(false),
    })
    .optional(),
});

export interface CtrRow {
  period_start: string;
  period_end: string;
  dimension?: Record<string, string>;
  impressions: number;
  clicks: number;
  ctr: number;
  unique_impressions?: number;
  unique_clicks?: number;
  unique_ctr?: number;
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

export const getCtrTool = {
  name: 'get-ctr',
  description:
    'Compute CTR (Click-Through Rate) per bucket with attribution window and optional breakdown. Returns impressions, clicks, ctr, and unique metrics.',
  inputSchema,
  execute: async (raw: unknown): Promise<{ data: CtrRow[] }> => {
    const input = inputSchema.parse(raw);
    const websiteId = await resolveWebsiteId(input.websiteId);
    if (!websiteId) throw new Error('websiteId is required.');

    const rows = await getEventsForCtr({
      websiteId,
      date_from: input.period.start,
      date_to: input.period.end,
    });

    // Impression predicate (event_type=1 and/or event_name matches configured keys)
    const impressionSet = new Set(input.impression_events.map(s => s.toLowerCase()));
    const clickSet = new Set(input.click_events.map(s => s.toLowerCase()));

    type Key = string;

    function getKey(r: any): Key {
      const by = input.breakdown?.by ?? null;
      switch (by) {
        case 'page_url':
          return `url:${r.url_path ?? ''}`;
        case 'device':
          return `dev:${r.device ?? ''}`;
        case 'country':
          return `cty:${r.country ?? ''}`;
        case 'utm_source':
          return `utm:${r.utm_source ?? ''}`;
        default:
          return 'all';
      }
    }

    const byBucket = new Map<
      string,
      Map<Key, { imps: number; clks: number; uImps: Set<string>; uClks: Set<string> }>
    >();

    for (const r of rows) {
      const ts = new Date(String((r as any).created_at));
      const start = new Date(`${toDateOnly(ts)}T00:00:00.000Z`);
      const bucketKey = toDateOnly(start);
      const breakdownKey = getKey(r as any);
      const entryMap = byBucket.get(bucketKey) ?? new Map();
      const entry = entryMap.get(breakdownKey) ?? {
        imps: 0,
        clks: 0,
        uImps: new Set<string>(),
        uClks: new Set<string>(),
      };

      const name = ((r as any).event_name || '').toLowerCase();
      const isPageview = Number((r as any).event_type) === 1;
      const isImpression = isPageview || impressionSet.has(name);
      const isClick = clickSet.has(name);

      if (isImpression) {
        entry.imps += 1;
        entry.uImps.add(String((r as any).session_id));
      }
      if (isClick) {
        entry.clks += 1;
        entry.uClks.add(String((r as any).session_id));
      }

      entryMap.set(breakdownKey, entry);
      byBucket.set(bucketKey, entryMap);
    }

    const data: CtrRow[] = [];
    for (const [bucket, mp] of byBucket) {
      for (const [k, v] of mp) {
        const start = new Date(`${bucket}T00:00:00.000Z`);
        const end = addDays(start, 1);
        const impressions = v.imps;
        const clicks = v.clks;
        const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
        const unique_impressions = v.uImps.size;
        const unique_clicks = v.uClks.size;
        const unique_ctr =
          unique_impressions > 0
            ? Number(((unique_clicks / unique_impressions) * 100).toFixed(2))
            : 0;

        const dimension =
          k === 'all'
            ? undefined
            : (() => {
                const [prefix, val] = k.split(':');
                switch (prefix) {
                  case 'url':
                    return { page_url: val };
                  case 'dev':
                    return { device: val };
                  case 'cty':
                    return { country: val };
                  case 'utm':
                    return { utm_source: val };
                  default:
                    return undefined;
                }
              })();

        data.push({
          period_start: toDateOnly(start),
          period_end: toDateOnly(new Date(end.getTime() - 1)),
          dimension,
          impressions,
          clicks,
          ctr,
          unique_impressions,
          unique_clicks,
          unique_ctr,
        });
      }
    }

    // Sort by bucket then optional dimension
    data.sort((a, b) =>
      a.period_start < b.period_start ? -1 : a.period_start > b.period_start ? 1 : 0,
    );
    return { data };
  },
};

export type GetCtrTool = typeof getCtrTool;
