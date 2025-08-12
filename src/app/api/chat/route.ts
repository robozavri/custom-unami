import { openai } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { getActiveUsersTool } from '@/app/chat/tools/get-active-users';
import { setActiveWebsiteTool } from '@/app/chat/tools/set-active-website';
import { getPageViewsTool } from '@/app/chat/tools/get-page-views';
import { getDetailedPageViewsTool } from '@/app/chat/tools/get-detailed-page-views';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Prevent deep generic inference by isolating tools in an 'any'-typed object
  const toolsAny: Record<string, any> = {
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
    'set-active-website': (tool as any)({
      description: setActiveWebsiteTool.description,
      inputSchema: setActiveWebsiteTool.inputSchema as z.ZodTypeAny,
      execute: async (params: unknown) => setActiveWebsiteTool.execute(params),
    }),
  };

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: toolsAny as any,
  });

  return result.toUIMessageStreamResponse();
}
