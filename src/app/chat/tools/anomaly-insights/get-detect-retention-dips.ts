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
  return_matrix: z.boolean().default(true),
});

type Input = z.infer<typeof inputSchema>;

// Types
export type CohortPeriod = 'day' | 'week' | 'month';
export type Sensitivity = 'low' | 'medium' | 'high';

export interface RetentionDipFinding {
  type: 'retention_dip';
  cohort_start: string;
  k: number;
  metric: 'retention';
  value: number;
  expected: number;
  effect_size: number;
  z?: number;
  support: number;
  explanation: string;
  recommended_checks: string[];
}

export interface RetentionDipOutput {
  findings: RetentionDipFinding[];
  summary: string;
  extras?: {
    matrix?: Array<{ cohort_start: string; k: number; rate: number; cohort_size: number }>;
    baselines?: Array<{ k: number; baseline: number }>;
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
        findings.push({
          type: 'retention_dip',
          cohort_start: cohort,
          k,
          metric: 'retention',
          value: rate,
          expected: baseline,
          effect_size: eff,
          z,
          support: size,
          explanation: `Cohort ${cohort} has k=${k} retention ${(rate * 100).toFixed(
            0,
          )}% vs baseline ${(baseline * 100).toFixed(0)}%`,
          recommended_checks: [
            'review onboarding between k-1 and k',
            'check feature launches or pricing changes in that window',
            'analyze email/push re-engagement for this cohort',
          ],
        });
      }
    }
  }

  // Rank by severity
  findings.sort((a, b) => {
    const sa = Math.max(Math.abs(a.z ?? 0), a.effect_size);
    const sb = Math.max(Math.abs(b.z ?? 0), b.effect_size);
    if (sb !== sa) return sb - sa;
    // tie-break by absolute gap
    return b.expected - b.value - (a.expected - a.value);
  });

  const summary = findings.length
    ? `Detected ${findings.length} retention dip(s). Top: cohort ${findings[0].cohort_start} at k=${
        findings[0].k
      } (${(findings[0].value * 100).toFixed(0)}% vs ${(findings[0].expected * 100).toFixed(0)}%).`
    : 'No significant retention dips detected for the selected period.';

  const extras =
    input.return_matrix !== false
      ? {
          matrix: Array.from(byCohort.entries()).flatMap(([cohort, data]) => {
            const rows: Array<{
              cohort_start: string;
              k: number;
              rate: number;
              cohort_size: number;
            }> = [];
            for (let k = 1; k <= max_k; k++) {
              const active = data.kAct.get(k) ?? 0;
              const rate = data.size > 0 ? active / data.size : 0;
              rows.push({ cohort_start: cohort, k, rate, cohort_size: data.size });
            }
            return rows;
          }),
          baselines: Array.from(baselineByK.entries()).map(([k, v]) => ({
            k,
            baseline: v.baseline,
          })),
        }
      : undefined;

  return { findings, summary, extras };
}
