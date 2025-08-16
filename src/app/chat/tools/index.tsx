import React from 'react';
import { tool } from 'ai';
import { getActiveUsersTool } from './get-active-users';
import { setActiveWebsiteTool } from './set-active-website';
import { getPageViewsTool } from './get-page-views';
import { getDetailedPageViewsTool } from './get-detailed-page-views';

// Modern AI SDK format - directly compatible with streamUI, generateText, etc.
export const chatTools = {
  'get-active-users': tool({
    description: getActiveUsersTool.description,
    inputSchema: getActiveUsersTool.inputSchema,
    execute: async params => {
      const result = await getActiveUsersTool.execute(params);
      return {
        interval: result.interval,
        date_from: result.date_from,
        date_to: result.date_to,
        data: result.data,
      };
    },
  }),

  'get-page-views': tool({
    description: getPageViewsTool.description,
    inputSchema: getPageViewsTool.inputSchema,
    execute: async params => {
      const result = await getPageViewsTool.execute(params);
      return {
        days: result.days,
        date_from: result.date_from,
        date_to: result.date_to,
        data: result.data,
      };
    },
  }),

  'get-detailed-page-views': tool({
    description: getDetailedPageViewsTool.description,
    inputSchema: getDetailedPageViewsTool.inputSchema,
    execute: async params => {
      const result = await getDetailedPageViewsTool.execute(params);
      return result;
    },
  }),

  'set-active-website': tool({
    description: setActiveWebsiteTool.description,
    inputSchema: setActiveWebsiteTool.inputSchema,
    execute: async params => {
      const result = await setActiveWebsiteTool.execute(params);
      return result;
    },
  }),
};

// Legacy format for backward compatibility with existing chat UI
export const chatToolsLegacy: Record<string, any> = {
  [getActiveUsersTool.name]: {
    description: getActiveUsersTool.description,
    parameters: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        interval: { type: 'string', enum: ['daily', 'weekly'], default: 'daily' },
        date_from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        date_to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        timezone: { type: 'string' },
      },
      additionalProperties: false,
    },
    generate: async (params: unknown) => {
      try {
        const result = await getActiveUsersTool.execute(params);
        return (
          <div style={{ padding: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Active users ({String(result.interval)})
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return (
          <div style={{ color: '#b91c1c', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
            Tool error (get-active-users): {message}
          </div>
        );
      }
    },
  },
  [getPageViewsTool.name]: {
    description: getPageViewsTool.description,
    parameters: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        days: { type: 'number', minimum: 1, default: 7 },
        date_from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        date_to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        path: { type: 'string' },
        timezone: { type: 'string' },
      },
      additionalProperties: false,
    },
    generate: async (params: unknown) => {
      try {
        const result = await getPageViewsTool.execute(params);
        return (
          <div style={{ padding: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Page views</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return (
          <div style={{ color: '#b91c1c', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
            Tool error (get-page-views): {message}
          </div>
        );
      }
    },
  },
  [getDetailedPageViewsTool.name]: {
    description: getDetailedPageViewsTool.description,
    parameters: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
        days: { type: 'number', minimum: 1, default: 7 },
        date_from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        date_to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        path: { type: 'string' },
      },
      additionalProperties: false,
    },
    generate: async (params: unknown) => {
      try {
        const result = await getDetailedPageViewsTool.execute(params);
        return (
          <div style={{ padding: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Detailed page views</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return (
          <div style={{ color: '#b91c1c', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
            Tool error (get-detailed-page-views): {message}
          </div>
        );
      }
    },
  },
  [setActiveWebsiteTool.name]: {
    description: setActiveWebsiteTool.description,
    parameters: {
      type: 'object',
      properties: {
        websiteId: { type: 'string' },
      },
      required: ['websiteId'],
      additionalProperties: false,
    },
    generate: async (params: unknown) => {
      try {
        const result = await setActiveWebsiteTool.execute(params);
        return (
          <div style={{ padding: 8 }}>
            <span>Active website set to </span>
            <code>{result.websiteId}</code>
          </div>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return (
          <div style={{ color: '#b91c1c', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
            Tool error (set-active-website): {message}
          </div>
        );
      }
    },
  },
};

export type ChatTool = (typeof chatTools)[keyof typeof chatTools];
