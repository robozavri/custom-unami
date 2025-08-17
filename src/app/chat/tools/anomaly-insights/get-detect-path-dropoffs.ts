import { z } from 'zod';
import { getActiveWebsiteId, setActiveWebsiteId } from '../../state';
import { DEFAULT_WEBSITE_ID } from '../../config';
import {
  getPathDropoffTransitions,
  type TransitionRow,
} from '@/queries/sql/anomaly-insights/getPathDropoffTransitions';
import prisma from '@/lib/prisma';

const sensitivityEnum = z.enum(['low', 'medium', 'high']);

const inputSchema = z.object({
  websiteId: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().default('UTC'),
  min_support: z.number().int().positive().default(100),
  min_effect_size: z.number().min(0).max(1).default(0.15),
  sensitivity: sensitivityEnum.default('medium'),
  include_step_dropoffs: z.boolean().default(true),
  normalize_paths: z.boolean().default(true),
});

type Input = z.infer<typeof inputSchema>;

// Sensitivity thresholds for anomaly detection
const SENSITIVITY_THRESHOLDS = {
  low: 3.0,
  medium: 2.5,
  high: 2.0,
};

// Calculate Median Absolute Deviation (MAD)
function calculateMAD(values: number[]): number {
  if (values.length === 0) return 0;

  const median = calculateMedian(values);
  const deviations = values.map(v => Math.abs(v - median));
  const madMedian = calculateMedian(deviations);

  // Convert MAD to standard deviation approximation: σ ≈ 1.4826 * MAD
  return 1.4826 * madMedian;
}

// Calculate median
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

interface PathDropoffFinding {
  type: 'dropoff';
  metric: 'exit_rate' | 'transition_rate';
  path_sequence: string[];
  value: number;
  expected: number;
  effect_size: number;
  z?: number;
  support: number;
  explanation: string;
  recommended_checks: string[];
}

interface PathDropoffOutput {
  findings: PathDropoffFinding[];
  summary: string;
  extras?: {
    exit_rates?: Array<{ path: string; rate: number; support: number }>;
    transitions?: Array<{ from_path: string | null; to_path: string | null; transitions: number }>;
  };
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

export const getDetectPathDropoffsTool = {
  name: 'get-detect-path-dropoffs',
  description: `
- Finds unusual path-level drop-offs by analyzing page transitions and exits within a date range.
- Detects both exit rate spikes and step drop-offs in user navigation paths.
- Uses robust statistical methods (MAD-based z-scores) to identify anomalies.
- Params:
  - websiteId (string, optional)
  - date_from (YYYY-MM-DD, required)
  - date_to (YYYY-MM-DD, required)
  - timezone (string, default "UTC")
  - min_support (number, default 100) - minimum transitions to consider
  - min_effect_size (number, default 0.15) - minimum effect size to flag
  - sensitivity (low|medium|high, default "medium") - affects detection threshold
  - include_step_dropoffs (boolean, default true) - also detect A->B transition drops
  - normalize_paths (boolean, default true) - normalize URL paths
- Returns findings with path sequences, effect sizes, and recommendations.
`.trim(),
  inputSchema,
  execute: async (rawParams: unknown): Promise<PathDropoffOutput> => {
    const params = inputSchema.parse(rawParams as Input);

    const websiteId = await resolveWebsiteId(params.websiteId);
    if (!websiteId) {
      throw new Error(
        'websiteId is required. Set an active website with set-active-website or configure DEFAULT_WEBSITE_ID.',
      );
    }

    const min_support = params.min_support;
    const min_effect_size = params.min_effect_size;
    const k = SENSITIVITY_THRESHOLDS[params.sensitivity];

    // Fetch transitions using the dedicated SQL query function
    const rows: TransitionRow[] = await getPathDropoffTransitions({
      websiteId,
      date_from: params.date_from,
      date_to: params.date_to,
      timezone: params.timezone,
      min_support,
      normalize_paths: params.normalize_paths,
    });

    // Aggregate totals and exits per from_path
    const totals = new Map<string, number>(); // total transitions leaving from_path
    const exits = new Map<string, number>(); // transitions to null
    const pair = new Map<string, number>(); // key "A||B" -> transitions(A->B)

    for (const r of rows) {
      const A = r.from_path ?? '__ENTRY__';
      const B = r.to_path ?? '__EXIT__';
      const transitions = Number(r.transitions); // Convert BigInt to number
      totals.set(A, (totals.get(A) ?? 0) + transitions);
      if (B === '__EXIT__') exits.set(A, (exits.get(A) ?? 0) + transitions);
      pair.set(`${A}||${B}`, (pair.get(`${A}||${B}`) ?? 0) + transitions);
    }

    // Build exit rates
    const exitRates: Array<{ path: string; rate: number; support: number }> = [];
    for (const [A, totalFrom] of totals.entries()) {
      if (A === '__ENTRY__') continue; // not a path page
      if (totalFrom < min_support) continue;
      const exitCount = exits.get(A) ?? 0;
      const rate = totalFrom > 0 ? exitCount / totalFrom : 0;
      exitRates.push({ path: A, rate, support: totalFrom });
    }

    // Cross-sectional baseline & robust z
    const values = exitRates.map(r => r.rate);
    const baseMed = calculateMedian(values);
    const m = calculateMAD(values);
    const sigma = 1.4826 * m;

    const findings: PathDropoffFinding[] = [];

    // Detect exit rate anomalies
    for (const r of exitRates) {
      const z = sigma > 0 ? (r.rate - baseMed) / sigma : 0;
      const delta = r.rate - baseMed; // effect size in absolute points (0..1 space)
      if (delta >= min_effect_size && Math.abs(z) >= k) {
        findings.push({
          type: 'dropoff',
          metric: 'exit_rate',
          path_sequence: [r.path],
          value: r.rate,
          expected: baseMed,
          effect_size: delta,
          z,
          support: r.support,
          explanation: `Exit rate on ${r.path} is ${(r.rate * 100).toFixed(0)}% vs ${(
            baseMed * 100
          ).toFixed(0)}% baseline`,
          recommended_checks: [
            'inspect UX & copy',
            'check page speed & errors',
            'review pricing or form friction',
          ],
        });
      }
    }

    // Optional: Step drop-offs (A -> B)
    if (params.include_step_dropoffs) {
      // For each A, compute distribution { P(X|A) }; flag low P(B|A) vs median P(X|A)
      const byA = new Map<string, Array<{ to: string; p: number; support: number }>>();
      for (const [key, nAB] of pair.entries()) {
        const [A, B] = key.split('||');
        if (A === '__ENTRY__' || B === '__EXIT__') continue; // skip entries/exits here
        const totalFrom = totals.get(A) ?? 0;
        if (totalFrom < min_support) continue;
        const p = totalFrom > 0 ? nAB / totalFrom : 0;
        const arr = byA.get(A) ?? [];
        arr.push({ to: B, p, support: nAB });
        byA.set(A, arr);
      }

      for (const [A, arr] of byA.entries()) {
        if (arr.length < 2) continue;
        const ps = arr.map(x => x.p);
        const medA = calculateMedian(ps);
        const mA = calculateMAD(ps);
        const sigmaA = 1.4826 * mA;

        for (const { to, p, support } of arr) {
          const delta = medA - p; // drop below median choices
          const z = sigmaA > 0 ? (p - medA) / sigmaA : 0;
          if (support >= min_support && delta >= min_effect_size && Math.abs(z) >= k) {
            findings.push({
              type: 'dropoff',
              metric: 'transition_rate',
              path_sequence: [A, to],
              value: p,
              expected: medA,
              effect_size: delta,
              z,
              support,
              explanation: `Transition ${A} → ${to} is ${(p * 100).toFixed(0)}% vs ${(
                medA * 100
              ).toFixed(0)}% among next-step choices`,
              recommended_checks: [
                'verify CTA to next step',
                'check layout changes',
                'analyze referrer expectations',
              ],
            });
          }
        }
      }
    }

    // Sort by severity
    findings.sort((a, b) => {
      const sa = Math.max(Math.abs(a.z ?? 0), a.effect_size);
      const sb = Math.max(Math.abs(b.z ?? 0), b.effect_size);
      if (sb !== sa) return sb - sa;
      return Math.abs(b.value - b.expected) - Math.abs(a.value - a.expected);
    });

    const summary = findings.length
      ? `Detected ${findings.length} drop-off(s). Top: ${
          findings[0].metric
        } at ${findings[0].path_sequence.join(' → ')}`
      : 'No significant path drop-offs detected for the selected period.';

    return {
      findings,
      summary,
      extras: {
        exit_rates: exitRates,
        transitions: rows,
      },
    };
  },
};
