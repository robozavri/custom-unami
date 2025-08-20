import debug from 'debug';
import { z } from 'zod';
import { tool } from 'ai';

// Import tool objects (server-side executors)
import { getActiveUsersTool } from './get-active-users';
import { setActiveWebsiteTool } from './set-active-website';
import { getPageViewsTool } from './get-page-views';
import { getDetailedPageViewsTool } from './get-detailed-page-views';
import { getUserBehaviorTool } from './get-user-behavior';
import { getRetentionTool } from './get-retention';
import { getWebStatisticTool } from './get-web-statistic';
import { getWebAnalyticsBreakdownTool } from './get-web-analytics-breakdown';
import { getPathTableTool } from './get-path-table';
import { getCountryTableTool } from './get-country-table';
import { getDetectTimeseriesAnomaliesTool } from './anomaly-insights';
import { getDetectPathDropoffsTool } from './anomaly-insights';
import { getDetectSegmentShiftsTool } from './anomaly-insights';
import { getDetectRetentionDipsTool } from './anomaly-insights';
import { getChurnRateTool } from './get-churn-rate';
import { getBounceRateTool } from './get-bounce-rate';
import { getAverageSessionLengthTool } from './get-average-session-length';
import { getCtrTool } from './get-click-through-rate';
import { checkTotalConversionDropTool } from './conversion-drop-insights/check-total-conversion-drop';
import {
  getEventOverviewTool,
  getEventConversionDropoffTool,
  getTotalEventCountTool,
  getUniqueUsersTool,
  getEventFrequencyPerUserTool,
  getTotalUniqueEventsTool,
  // Event Trends Tools
  getEventsPerPeriodTool,
  getReturningEventUsersTool,
  getSegmentedEventsTool,
  getEventTrendsTool,
} from './event-tools';

const log = debug('umami:chat:tools');

// Central builder for the chat tools map used by the API route and any other consumers
export function buildToolsMap(): Record<string, any> {
  return {
    'get-active-users': (tool as any)({
      description: getActiveUsersTool.description,
      inputSchema: getActiveUsersTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getActiveUsersTool.execute(params),
    }),
    'get-page-views': (tool as any)({
      description: getPageViewsTool.description,
      inputSchema: getPageViewsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getPageViewsTool.execute(params),
    }),
    'get-detailed-page-views': (tool as any)({
      description: getDetailedPageViewsTool.description,
      inputSchema: getDetailedPageViewsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getDetailedPageViewsTool.execute(params),
    }),
    'get-user-behavior': (tool as any)({
      description: getUserBehaviorTool.description,
      inputSchema: getUserBehaviorTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getUserBehaviorTool.execute(params),
    }),
    'get-retention': (tool as any)({
      description: getRetentionTool.description,
      inputSchema: getRetentionTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getRetentionTool.execute(params),
    }),
    'get-web-statistic': (tool as any)({
      description: getWebStatisticTool.description,
      inputSchema: getWebStatisticTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getWebStatisticTool.execute(params),
    }),
    'get-web-analytics-breakdown': (tool as any)({
      description: getWebAnalyticsBreakdownTool.description,
      inputSchema: getWebAnalyticsBreakdownTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getWebAnalyticsBreakdownTool.execute(params),
    }),
    'set-active-website': (tool as any)({
      description: setActiveWebsiteTool.description,
      inputSchema: setActiveWebsiteTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => setActiveWebsiteTool.execute(params),
    }),
    'get-pathTable': (tool as any)({
      description: getPathTableTool.description,
      inputSchema: getPathTableTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getPathTableTool.execute(params),
    }),
    'get-country-table': (tool as any)({
      description: getCountryTableTool.description,
      inputSchema: getCountryTableTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getCountryTableTool.execute(params),
    }),
    'get-detect-timeseries-anomalies': (tool as any)({
      description: getDetectTimeseriesAnomaliesTool.description,
      inputSchema: getDetectTimeseriesAnomaliesTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => {
        log('invoke get-detect-timeseries-anomalies', params);
        // eslint-disable-next-line no-console
        console.log('[tools][invoke] get-detect-timeseries-anomalies', params);
        try {
          const result = await getDetectTimeseriesAnomaliesTool.execute(params);
          log('result get-detect-timeseries-anomalies', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            anomalies: Array.isArray((result as any)?.anomalies)
              ? (result as any).anomalies.length
              : null,
            series: Array.isArray((result as any)?.series) ? (result as any).series.length : null,
          });
          // eslint-disable-next-line no-console
          console.log('[tools][result] get-detect-timeseries-anomalies', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            anomalies: Array.isArray((result as any)?.anomalies)
              ? (result as any).anomalies.length
              : null,
            series: Array.isArray((result as any)?.series) ? (result as any).series.length : null,
          });
          return result;
        } catch (error) {
          log('error get-detect-timeseries-anomalies', error);
          // eslint-disable-next-line no-console
          console.error('[tools][error] get-detect-timeseries-anomalies', error);
          throw error;
        }
      },
    }),
    'get-detect-path-dropoffs': (tool as any)({
      description: getDetectPathDropoffsTool.description,
      inputSchema: getDetectPathDropoffsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => {
        log('invoke get-detect-path-dropoffs', params);
        // eslint-disable-next-line no-console
        console.log('[tools][invoke] get-detect-path-dropoffs', params);
        try {
          const result = await getDetectPathDropoffsTool.execute(params);
          log('result get-detect-path-dropoffs', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            findings: Array.isArray((result as any)?.findings)
              ? (result as any).findings.length
              : null,
          });
          // eslint-disable-next-line no-console
          console.log('[tools][result] get-detect-path-dropoffs', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            findings: Array.isArray((result as any)?.findings)
              ? (result as any).findings.length
              : null,
          });
          return result;
        } catch (error) {
          log('error get-detect-path-dropoffs', error);
          // eslint-disable-next-line no-console
          console.error('[tools][error] get-detect-path-dropoffs', error);
          throw error;
        }
      },
    }),
    'get-detect-segment-shifts': (tool as any)({
      description: getDetectSegmentShiftsTool.description,
      inputSchema: getDetectSegmentShiftsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => {
        log('invoke get-detect-segment-shifts', params);
        // eslint-disable-next-line no-console
        console.log('[tools][invoke] get-detect-segment-shifts', params);
        try {
          const result = await getDetectSegmentShiftsTool.execute(params);
          log('result get-detect-segment-shifts', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            findings: Array.isArray((result as any)?.findings)
              ? (result as any).findings.length
              : null,
          });
          // eslint-disable-next-line no-console
          console.log('[tools][result] get-detect-segment-shifts', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            findings: Array.isArray((result as any)?.findings)
              ? (result as any).findings.length
              : null,
          });
          return result;
        } catch (error) {
          log('error get-detect-segment-shifts', error);
          // eslint-disable-next-line no-console
          console.error('[tools][error] get-detect-segment-shifts', error);
          throw error;
        }
      },
    }),
    'get-detect-retention-dips': (tool as any)({
      description: getDetectRetentionDipsTool.description,
      inputSchema: getDetectRetentionDipsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => {
        log('invoke get-detect-retention-dips', params);
        // eslint-disable-next-line no-console
        console.log('[tools][invoke] get-detect-retention-dips', params);
        try {
          const result = await getDetectRetentionDipsTool.execute(params);
          log('result get-detect-retention-dips', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            findings: Array.isArray((result as any)?.findings)
              ? (result as any).findings.length
              : null,
          });
          // eslint-disable-next-line no-console
          console.log('[tools][result] get-detect-retention-dips', {
            hasSummaryKeys: result ? Object.keys(result).length : 0,
            findings: Array.isArray((result as any)?.findings)
              ? (result as any).findings.length
              : null,
          });
          return result;
        } catch (error) {
          log('error get-detect-retention-dips', error);
          // eslint-disable-next-line no-console
          console.error('[tools][error] get-detect-retention-dips', error);
          throw error;
        }
      },
    }),
    'get-churn-rate': (tool as any)({
      description: getChurnRateTool.description,
      inputSchema: getChurnRateTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => {
        log('invoke get-churn-rate', params);
        // eslint-disable-next-line no-console
        console.log('[tools][invoke] get-churn-rate', params);
        try {
          const result = await getChurnRateTool.execute(params);
          log('result get-churn-rate', {
            rows: Array.isArray((result as any)?.data) ? (result as any).data.length : null,
          });
          // eslint-disable-next-line no-console
          console.log('[tools][result] get-churn-rate', {
            rows: Array.isArray((result as any)?.data) ? (result as any).data.length : null,
          });
          return result;
        } catch (error) {
          log('error get-churn-rate', error);
          // eslint-disable-next-line no-console
          console.error('[tools][error] get-churn-rate', error);
          throw error;
        }
      },
    }),
    'get-bounce-rate': (tool as any)({
      description: getBounceRateTool.description,
      inputSchema: getBounceRateTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getBounceRateTool.execute(params),
    }),
    'get-average-session-length': (tool as any)({
      description: getAverageSessionLengthTool.description,
      inputSchema: getAverageSessionLengthTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getAverageSessionLengthTool.execute(params),
    }),
    'get-click-through-rate': (tool as any)({
      description: getCtrTool.description,
      inputSchema: getCtrTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getCtrTool.execute(params),
    }),
    'check-total-conversion-drop': (tool as any)({
      description: checkTotalConversionDropTool.description,
      inputSchema: checkTotalConversionDropTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => checkTotalConversionDropTool.execute(params),
    }),
    'get-event-overview': (tool as any)({
      description: getEventOverviewTool.description,
      inputSchema: getEventOverviewTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getEventOverviewTool.execute(params),
    }),
    'get-event-conversion-dropoff': (tool as any)({
      description: getEventConversionDropoffTool.description,
      inputSchema: getEventConversionDropoffTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getEventConversionDropoffTool.execute(params),
    }),
    'get-total-event-count': (tool as any)({
      description: getTotalEventCountTool.description,
      inputSchema: getTotalEventCountTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getTotalEventCountTool.execute(params),
    }),
    'get-unique-users': (tool as any)({
      description: getUniqueUsersTool.description,
      inputSchema: getUniqueUsersTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getUniqueUsersTool.execute(params),
    }),
    'get-event-frequency-per-user': (tool as any)({
      description: getEventFrequencyPerUserTool.description,
      inputSchema: getEventFrequencyPerUserTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getEventFrequencyPerUserTool.execute(params),
    }),
    'get-total-unique-events': (tool as any)({
      description: getTotalUniqueEventsTool.description,
      inputSchema: getTotalUniqueEventsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getTotalUniqueEventsTool.execute(params),
    }),
    // Event Trends Tools
    'get-events-per-period': (tool as any)({
      description: getEventsPerPeriodTool.description,
      inputSchema: getEventsPerPeriodTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getEventsPerPeriodTool.execute(params),
    }),
    'get-returning-event-users': (tool as any)({
      description: getReturningEventUsersTool.description,
      inputSchema: getReturningEventUsersTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getReturningEventUsersTool.execute(params),
    }),
    'get-segmented-events': (tool as any)({
      description: getSegmentedEventsTool.description,
      inputSchema: getSegmentedEventsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getSegmentedEventsTool.execute(params),
    }),
    'get-event-trends': (tool as any)({
      description: getEventTrendsTool.description,
      inputSchema: getEventTrendsTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => getEventTrendsTool.execute(params),
    }),
  };
}

export type BuiltToolsMap = ReturnType<typeof buildToolsMap>;
