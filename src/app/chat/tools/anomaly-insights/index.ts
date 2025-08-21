import { z } from 'zod';
import { getDetectTimeseriesAnomaliesTool } from './get-detect-timeseries-anomalies';
import { getDetectRetentionDipsTool } from './get-detect-retention-dips';
import { getDetectSegmentShiftsTool } from './get-detect-segment-shifts';
import { getDetectPathDropoffsTool } from './get-detect-path-dropoffs';
import { getWebsiteId } from '../../state';

// Unified input schema for all anomaly detection types
export const anomalyInsightsInputSchema = z.object({
  // Required: specify which type of anomaly detection to run
  type: z.enum(['timeseries', 'retention_dips', 'segment_shifts', 'path_dropoffs']),

  // Common parameters
  websiteId: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().default('UTC').optional(),

  // Timeseries-specific parameters
  metric: z.enum(['visits', 'pageviews', 'bounce_rate', 'visit_duration']).optional(),
  interval: z.enum(['hour', 'day', 'week']).optional(),
  sensitivity: z.enum(['low', 'medium', 'high']).optional(),

  // Retention dips-specific parameters
  period: z.enum(['day', 'week', 'month']).optional(),
  max_k: z.number().min(1).max(52).optional(),
  min_cohort_size: z.number().min(1).optional(),
  min_effect_size: z.number().min(0).max(1).optional(),
  return_matrix: z.boolean().optional(),

  // Segment shifts-specific parameters
  segment_by: z
    .union([
      z.enum(['country', 'device', 'browser', 'referrer_domain', 'utm_source', 'path']),
      z.array(z.enum(['country', 'device', 'browser', 'referrer_domain', 'utm_source', 'path'])),
    ])
    .optional(),
  min_share: z.number().min(0).max(1).optional(),
  min_support: z.number().min(1).optional(),
  use_chi_square: z.boolean().optional(),
  normalize_labels: z.boolean().optional(),

  // Path dropoffs-specific parameters
  include_step_dropoffs: z.boolean().optional(),
  normalize_paths: z.boolean().optional(),
});

type AnomalyInsightsInput = z.infer<typeof anomalyInsightsInputSchema>;

type AnomalyInsightsOutput =
  | { type: 'timeseries'; data: any }
  | { type: 'retention_dips'; data: any }
  | { type: 'segment_shifts'; data: any }
  | { type: 'path_dropoffs'; data: any };

export const anomalyInsightsTool = {
  name: 'anomaly-insights',
  description:
    'Unified anomaly detection tool. Set type to one of timeseries | retention_dips | segment_shifts | path_dropoffs and pass the corresponding params.',
  inputSchema: anomalyInsightsInputSchema,

  async resolveWebsiteId(websiteIdInput?: string): Promise<string> {
    return getWebsiteId(websiteIdInput);
  },

  execute: async (params: AnomalyInsightsInput): Promise<AnomalyInsightsOutput> => {
    const { type, ...rest } = params;

    // Resolve websiteId with database fallback
    const websiteId = await anomalyInsightsTool.resolveWebsiteId(rest.websiteId);
    // websiteId is guaranteed to be a valid string from getWebsiteId

    switch (type) {
      case 'timeseries': {
        const result = await getDetectTimeseriesAnomaliesTool.execute({
          metric: rest.metric!,
          websiteId: websiteId,
          date_from: rest.date_from,
          date_to: rest.date_to,
          interval: rest.interval ?? 'day',
          sensitivity: rest.sensitivity ?? 'medium',
        } as any);
        return { type: 'timeseries', data: result };
      }
      case 'retention_dips': {
        const result = await getDetectRetentionDipsTool.execute({
          websiteId: websiteId,
          date_from: rest.date_from,
          date_to: rest.date_to,
          period: rest.period ?? 'week',
          max_k: rest.max_k ?? 12,
          timezone: rest.timezone ?? 'UTC',
          min_cohort_size: rest.min_cohort_size ?? 50,
          min_effect_size: rest.min_effect_size ?? 0.15,
          sensitivity: rest.sensitivity ?? 'medium',
          return_matrix: rest.return_matrix ?? true,
        } as any);
        return { type: 'retention_dips', data: result };
      }
      case 'segment_shifts': {
        const result = await getDetectSegmentShiftsTool.execute({
          websiteId: websiteId,
          date_from: rest.date_from,
          date_to: rest.date_to,
          segment_by: rest.segment_by!,
          metric: (rest.metric as any) ?? 'visits',
          timezone: rest.timezone ?? 'UTC',
          min_effect_size: rest.min_effect_size ?? 0.01,
          min_share: rest.min_share ?? 0.05,
          min_support: rest.min_support ?? 100,
          use_chi_square: rest.use_chi_square ?? false,
          normalize_labels: rest.normalize_labels ?? true,
        } as any);
        return { type: 'segment_shifts', data: result };
      }
      case 'path_dropoffs': {
        const result = await getDetectPathDropoffsTool.execute({
          websiteId: websiteId,
          date_from: rest.date_from,
          date_to: rest.date_to,
          timezone: rest.timezone ?? 'UTC',
          min_support: rest.min_support ?? 100,
          min_effect_size: rest.min_effect_size ?? 0.15,
          sensitivity: rest.sensitivity ?? 'medium',
          include_step_dropoffs: rest.include_step_dropoffs ?? true,
          normalize_paths: rest.normalize_paths ?? true,
        } as any);
        return { type: 'path_dropoffs', data: result };
      }
      default:
        throw new Error(`Unknown anomaly detection type: ${type}`);
    }
  },
};

// Re-export individual tools for backward compatibility
export * from './get-detect-timeseries-anomalies';
export * from './get-detect-path-dropoffs';
export * from './get-detect-segment-shifts';
export * from './get-detect-retention-dips';
