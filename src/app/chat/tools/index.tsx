import React from 'react';
import { getActiveUsersTool } from './get-active-users';
import { setActiveWebsiteTool } from './set-active-website';

// Render tools for streamUI: description, parameters (zod), and async generate that returns ReactNode

export const chatTools: Record<string, any> = {
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
