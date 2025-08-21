import { z } from 'zod';
import { getSegmentTotals, SegmentTotal } from '@/queries/sql/anomaly-insights/getSegmentTotals';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { DEFAULT_WEBSITE_ID } from '../../config';

// Input schema
const inputSchema = z.object({
  websiteId: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  segment_by: z.union([
    z.enum(['country', 'device', 'browser', 'referrer_domain', 'utm_source', 'path']),
    z.array(z.enum(['country', 'device', 'browser', 'referrer_domain', 'utm_source', 'path'])),
  ]),
  metric: z.enum(['visits', 'pageviews', 'bounce_rate']).default('visits'),
  timezone: z.string().default('UTC'),
  min_effect_size: z.number().min(0).max(1).default(0.01),
  min_share: z.number().min(0).max(1).default(0.05),
  min_support: z.number().min(1).default(100),
  use_chi_square: z.boolean().default(false),
  normalize_labels: z.boolean().default(true),
});

type Input = z.infer<typeof inputSchema>;

// Types
export type SegmentKey =
  | 'country'
  | 'device'
  | 'browser'
  | 'referrer_domain'
  | 'utm_source'
  | 'path';
export type SegmentMetric = 'visits' | 'pageviews' | 'bounce_rate';

export interface SegmentShiftFinding {
  type: 'shift';
  metric: SegmentMetric;
  segment_by: SegmentKey;
  label: string;
  value: number;
  expected: number;
  effect_size: number;
  p_value?: number;
  support_curr: number;
  support_prev: number;
  explanation: string;
  recommended_checks: string[];
}

export interface SegmentShiftOutput {
  findings: SegmentShiftFinding[];
  summary: string;
  extras?: {
    current?: Array<{ label: string; value: number }>;
    previous?: Array<{ label: string; value: number }>;
  };
}

// Tool configuration
export const getDetectSegmentShiftsTool = {
  name: 'detect-segment-shifts',
  description:
    'Detects significant share shifts by segment (country, device, browser, referrer_domain, utm_source, path) comparing current vs previous window. Sensitive by default (1pp threshold) with chi-square testing disabled for easier use.',
  inputSchema,
  execute: async (params: Input): Promise<SegmentShiftOutput> => {
    return detectSegmentShifts(params);
  },
};

// Utility functions
function toMap(rows: SegmentTotal[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const label = r.label || 'unknown';
    // Convert BigInt to number to avoid mixing types
    const value = typeof r.value === 'bigint' ? Number(r.value) : r.value ?? 0;
    m.set(label, (m.get(label) ?? 0) + value);
  }
  return m;
}

function chiSquarePValue(a: number, b: number, c: number, d: number): number {
  // 2x2 chi-square with Yates continuity correction (approx)
  // a=C_i, b=C-C_i, c=P_i, d=P-P_i
  const n = a + b + c + d;
  if (n === 0) return 1;

  const ad = a * d,
    bc = b * c;
  const num = Math.abs(ad - bc) - n / 2;
  const x2 = (n * Math.pow(num, 2)) / ((a + b) * (c + d) * (a + c) * (b + d) + 1e-9);

  // Convert x2 to p-value with df=1 using complementary error function approx
  // p ≈ exp(-x2/2) * (1 + x2/2) (upper tail approximation)
  const p = Math.exp(-x2 / 2) * (1 + x2 / 2);
  return Math.min(Math.max(p, 0), 1);
}

function previousWindow(date_from: string, date_to: string) {
  const from = new Date(date_from + 'T00:00:00Z');
  const to = new Date(date_to + 'T00:00:00Z');
  const days = Math.round((+to - +from) / 86400000) + 1;
  const prevTo = new Date(+from - 86400000);
  const prevFrom = new Date(+prevTo - (days - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(prevFrom), to: iso(prevTo) };
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

// Main detection logic
async function detectSegmentShifts(input: Input): Promise<SegmentShiftOutput> {
  // DEBUG: To enable detailed logging, temporarily add console.log statements here
  // and set ESLint rule "no-console": "warn" in .eslintrc.json

  const metric: SegmentMetric = input.metric ?? 'visits';
  const tz = input.timezone ?? 'UTC';
  const min_effect = input.min_effect_size ?? 0.01;
  const min_share = input.min_share ?? 0.05;
  const min_support = input.min_support ?? 100;
  const use_chi = input.use_chi_square ?? false;

  const segmentKeys: SegmentKey[] = Array.isArray(input.segment_by)
    ? input.segment_by
    : [input.segment_by];

  const websiteId = await resolveWebsiteId(input.websiteId);
  if (!websiteId) {
    throw new Error('No website ID available');
  }

  const prev = previousWindow(input.date_from, input.date_to);
  const findings: SegmentShiftFinding[] = [];

  for (const segment_by of segmentKeys) {
    // Fetch current & previous totals by label
    const currentRows = await getSegmentTotals({
      websiteId,
      metric,
      segment_by,
      date_from: input.date_from,
      date_to: input.date_to,
      timezone: tz,
      normalize_labels: input.normalize_labels ?? true,
    });

    const previousRows = await getSegmentTotals({
      websiteId,
      metric,
      segment_by,
      date_from: prev.from,
      date_to: prev.to,
      timezone: tz,
      normalize_labels: input.normalize_labels ?? true,
    });

    const curMap = toMap(currentRows);
    const prevMap = toMap(previousRows);
    const C = [...curMap.values()].reduce((s, v) => s + v, 0);
    const P = [...prevMap.values()].reduce((s, v) => s + v, 0);

    if (C < min_support || P < min_support) {
      continue; // not enough data
    }

    // Compute shares and deltas
    const labels = new Set([...curMap.keys(), ...prevMap.keys()]);

    for (const label of labels) {
      const Ci = curMap.get(label) ?? 0;
      const Pi = prevMap.get(label) ?? 0;
      const s = C > 0 ? Ci / C : 0;
      const sp = P > 0 ? Pi / P : 0;

      if (s < min_share && sp < min_share) continue;

      const delta = s - sp; // >0 means share increased
      const absDelta = Math.abs(delta);

      if (absDelta >= min_effect) {
        let pval: number | undefined = undefined;
        if (use_chi) {
          const a = Ci,
            b = C - Ci,
            c = Pi,
            d = P - Pi;
          pval = chiSquarePValue(a, b, c, d);

          // Require both practical significance and statistical support
          if (pval >= 0.05) continue;
        }

        findings.push({
          type: 'shift',
          metric,
          segment_by,
          label,
          value: s,
          expected: sp,
          effect_size: absDelta,
          p_value: pval,
          support_curr: C,
          support_prev: P,
          explanation: `${segment_by}=${label} share ${
            delta >= 0 ? 'increased' : 'decreased'
          } by ${(absDelta * 100).toFixed(0)}pp (${(sp * 100).toFixed(0)}% → ${(s * 100).toFixed(
            0,
          )}%)`,
          recommended_checks: [
            'inspect campaigns/referrers',
            'review geo/device targeting',
            'check landing page relevance',
          ],
        });
      }
    }
  }

  // Rank by effect size then by support
  findings.sort((a, b) => {
    if (b.effect_size !== a.effect_size) return b.effect_size - a.effect_size;
    const sa = a.support_curr + a.support_prev;
    const sb = b.support_curr + b.support_prev;
    return sb - sa;
  });

  const summary = findings.length
    ? `Detected ${findings.length} segment shift(s). Top: ${findings[0].segment_by}=${
        findings[0].label
      } ${(findings[0].effect_size * 100).toFixed(0)}pp change.`
    : 'No significant segment shifts detected for the selected period.';

  // Prepare extras with actual data for the first segment if available
  let extras = { current: [], previous: [] };
  if (segmentKeys.length > 0) {
    const firstSegment = segmentKeys[0];
    try {
      const currentRows = await getSegmentTotals({
        websiteId,
        metric,
        segment_by: firstSegment,
        date_from: input.date_from,
        date_to: input.date_to,
        timezone: tz,
        normalize_labels: input.normalize_labels ?? true,
      });

      const prev = previousWindow(input.date_from, input.date_to);
      const previousRows = await getSegmentTotals({
        websiteId,
        metric,
        segment_by: firstSegment,
        date_from: prev.from,
        date_to: prev.to,
        timezone: tz,
        normalize_labels: input.normalize_labels ?? true,
      });

      extras = {
        current: currentRows.slice(0, 10).map(r => ({
          label: r.label || 'unknown',
          value: typeof r.value === 'bigint' ? Number(r.value) : r.value ?? 0,
        })),
        previous: previousRows.slice(0, 10).map(r => ({
          label: r.label || 'unknown',
          value: typeof r.value === 'bigint' ? Number(r.value) : r.value ?? 0,
        })),
      };
    } catch (error) {
      // If there's an error fetching extras, just continue with empty arrays
      // Silently continue with empty arrays
    }
  }

  return {
    findings,
    summary,
    extras,
  };
}
