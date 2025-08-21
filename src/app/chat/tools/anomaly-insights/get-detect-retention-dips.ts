import { z } from 'zod';
import { getRetentionCohorts, CohortRow } from '@/queries/sql/anomaly-insights/getRetentionCohorts';
import prisma from '@/lib/prisma';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { DEFAULT_WEBSITE_ID } from '../../config';

// Input schema
const inputSchema = z.object({
  websiteId: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(['day', 'week', 'month']).default('week'),
  max_k: z.number().min(1).max(52).default(12),
  timezone: z.string().default('UTC'),
  min_cohort_size: z.number().min(1).default(50),
  min_effect_size: z.number().min(0).max(1).default(0.15),
  sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  // Default to false to avoid large payloads unless explicitly requested
  return_matrix: z.boolean().default(false),
});

type Input = z.infer<typeof inputSchema>;

// Types
export type CohortPeriod = 'day' | 'week' | 'month';
export type Sensitivity = 'low' | 'medium' | 'high';

export interface RetentionDipFinding {
  type: 'retention_dip';
  cohort_start: string;
  period_number: number; // 1-based offset in selected period granularity
  metric: 'retention';
  value: number; // actual retention rate (0..1)
  expected: number; // baseline retention rate (0..1)
  effect_size: number; // absolute gap vs baseline (0..1)
  z_score?: number; // standardized distance vs median baseline
  support: number; // cohort size
  // Compact, structured fields for easier consumption
  severity: 'low' | 'medium' | 'high';
  drop_percentage: number; // effect size in percentage points
  actual_percentage: number; // value in percentage points
  baseline_percentage: number; // expected in percentage points
}

export interface RetentionDipOutput {
  findings: RetentionDipFinding[];
  summary: string;
  extras?: {
    cohort_count: number;
    total_users_analyzed: number;
    baseline_summary: Array<{
      period_number: number;
      median_retention: number;
      normal_range: [number, number];
    }>;
  };
}

// Tool configuration
export const getDetectRetentionDipsTool = {
  name: 'detect-retention-dips',
  description:
    "Detects cohort retention dips (daily/weekly/monthly) by comparing each cohort's rate at offset k to a robust cross-cohort baseline for the same k.",
  inputSchema,
  execute: async (params: Input): Promise<RetentionDipOutput> => {
    return detectRetentionDips(params);
  },
};

// Utility functions
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mad(xs: number[], m?: number): number {
  const mu = m ?? median(xs);
  const devs = xs.map(v => Math.abs(v - mu));
  return median(devs);
}

function kThreshold(s: Sensitivity = 'medium'): number {
  return s === 'low' ? 3 : s === 'high' ? 2 : 2.5;
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
async function detectRetentionDips(input: Input): Promise<RetentionDipOutput> {
  const period: CohortPeriod = input.period ?? 'week';
  const max_k = input.max_k ?? 12;
  const tz = input.timezone ?? 'UTC';
  const minSize = input.min_cohort_size ?? 50;
  const minEff = input.min_effect_size ?? 0.15;
  const zThresh = kThreshold(input.sensitivity ?? 'medium');

  const websiteId = await resolveWebsiteId(input.websiteId);
  if (!websiteId) {
    throw new Error('No website ID available');
  }

  const rows: CohortRow[] = await getRetentionCohorts({
    websiteId,
    period,
    date_from: input.date_from,
    date_to: input.date_to,
    timezone: tz,
    max_k,
  });

  // Build cohort -> size & per-k actives
  // Convert BigInt values from database to numbers for calculations
  const byCohort = new Map<string, { size: number; kAct: Map<number, number> }>();
  for (const r of rows) {
    const ent = byCohort.get(r.cohort_start) ?? { size: 0, kAct: new Map() };
    if (r.k === 0) ent.size = Number(r.active_users);
    else if (r.k > 0 && r.k <= max_k) ent.kAct.set(r.k, Number(r.active_users));
    byCohort.set(r.cohort_start, ent);
  }

  // Compute per-k arrays of retention rates across cohorts
  const ratesByK = new Map<number, Array<{ cohort: string; rate: number; size: number }>>();
  for (const [cohort, data] of byCohort.entries()) {
    if (data.size < minSize || data.size <= 0) continue;
    for (const [k, active] of data.kAct.entries()) {
      if (k < 1 || k > max_k) continue;
      const rate = active / data.size;
      const arr = ratesByK.get(k) ?? [];
      arr.push({ cohort, rate, size: data.size });
      ratesByK.set(k, arr);
    }
  }

  // Compute baselines per k
  const baselineByK = new Map<number, { baseline: number; sigma: number }>();
  for (const [k, arr] of ratesByK.entries()) {
    const xs = arr.map(x => x.rate);
    const base = median(xs);
    const sig = 1.4826 * mad(xs, base);
    baselineByK.set(k, { baseline: base, sigma: sig });
  }

  // Create findings
  const findings: RetentionDipFinding[] = [];
  for (const [k, arr] of ratesByK.entries()) {
    const { baseline, sigma } = baselineByK.get(k)!;
    for (const { cohort, rate, size } of arr) {
      const eff = Math.max(0, baseline - rate);
      const z = sigma > 0 ? (rate - baseline) / sigma : 0;
      if (size >= minSize && eff >= minEff && Math.abs(z) >= zThresh) {
        const absZ = Math.abs(z);
        const severity: 'low' | 'medium' | 'high' =
          eff >= 0.2 || absZ >= 3 ? 'high' : eff >= 0.1 || absZ >= 2.5 ? 'medium' : 'low';

        findings.push({
          type: 'retention_dip',
          cohort_start: cohort,
          period_number: k,
          metric: 'retention',
          value: rate,
          expected: baseline,
          effect_size: eff,
          z_score: z,
          support: size,
          severity,
          drop_percentage: eff * 100,
          actual_percentage: rate * 100,
          baseline_percentage: baseline * 100,
        });
      }
    }
  }

  // Rank by severity
  findings.sort((a, b) => {
    const sa = Math.max(Math.abs(a.z_score ?? 0), a.effect_size);
    const sb = Math.max(Math.abs(b.z_score ?? 0), b.effect_size);
    if (sb !== sa) return sb - sa;
    // tie-break by absolute gap
    return b.expected - b.value - (a.expected - a.value);
  });

  const summary = findings.length
    ? `Detected ${findings.length} retention dip(s). Top: cohort ${
        findings[0].cohort_start
      } at period ${findings[0].period_number} (${findings[0].actual_percentage.toFixed(
        0,
      )}% vs ${findings[0].baseline_percentage.toFixed(0)}%).`
    : 'No significant retention dips detected for the selected period.';

  // Build lightweight extras summary instead of returning a large matrix
  const analyzedCohorts: Array<{ cohort: string; size: number }> = Array.from(byCohort.entries())
    .filter(([, data]) => data.size >= minSize && data.size > 0)
    .map(([cohort, data]) => ({ cohort, size: data.size }));

  const cohort_count = analyzedCohorts.length;
  const total_users_analyzed = analyzedCohorts.reduce((sum, x) => sum + x.size, 0);

  const baseline_summary = Array.from(baselineByK.entries())
    .map(([k, v]) => {
      const min = Math.max(0, v.baseline - v.sigma);
      const max = Math.min(1, v.baseline + v.sigma);
      return {
        period_number: k,
        median_retention: v.baseline,
        normal_range: [min, max] as [number, number],
      };
    })
    .sort((a, b) => a.period_number - b.period_number);

  const extras = { cohort_count, total_users_analyzed, baseline_summary };

  return { findings, summary, extras };
}
