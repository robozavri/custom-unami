// import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { buildToolsMap } from '@/app/chat/tools/registry';

export const maxDuration = 30;

export async function POST(req: Request) {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'Missing OPENAI_API_KEY. Set it in your environment and restart the server.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // Prevent deep generic inference by isolating tools in an 'any'-typed object
  const toolsAny: Record<string, any> = buildToolsMap();

  const result = streamText({
    // model: openai('gpt-3.5-turbo'),
    model: anthropic('claude-3-haiku-20240307'),
    system: `You are a helpful AI assistant for Umami analytics. When calling any tool that accepts date parameters, ALWAYS pass the current year and current month by default unless the user specifies otherwise.

IMPORTANT RULES:
1. For tools that accept date parameters (like get-page-views), always set:
   - date_from: current year and month (e.g., "2024-01-01" for January 2024)
   - date_to: current year and month (e.g., "2024-01-31" for January 2024)
   - days: 30 (for current month) or 365 (for current year)

2. If the user asks for "current" data, use the current year/month
3. If the user asks for "last month", use the previous month
4. If the user asks for "this year", use the current year

5. Always show tool results in a clear, formatted table when possible.

Example: If today is January 2024, and user asks for page views, call get-page-views with date_from: "2024-01-01" and date_to: "2024-01-31"
Displaying data in a table is preferred.`,
    messages: [...convertToModelMessages(messages)],
    stopWhen: stepCountIs(5),
    tools: toolsAny as any,
  });

  return result.toUIMessageStreamResponse();
}
