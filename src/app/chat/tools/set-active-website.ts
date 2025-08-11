import { z } from 'zod';
import { setActiveWebsiteId } from '../state';

const paramsSchema = z.object({
  websiteId: z.string().min(1, 'websiteId is required'),
});

export const setActiveWebsiteTool = {
  name: 'set-active-website',
  description: `
- Set the active websiteId for subsequent tools.
- Params:
  - websiteId (string, required)
- Example: {"websiteId":"<uuid>"}
`.trim(),
  inputSchema: paramsSchema,
  execute: async (rawParams: unknown) => {
    const { websiteId } = paramsSchema.parse(rawParams);
    setActiveWebsiteId(websiteId);
    return { ok: true, websiteId };
  },
};

export type SetActiveWebsiteTool = typeof setActiveWebsiteTool;
