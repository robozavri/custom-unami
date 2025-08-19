import { openai } from '@ai-sdk/openai';
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
    model: openai('gpt-4o-mini'),
    system: `pass the date range of the current year and the current month to the tool. 
    show tool result as table`,
    messages: [...convertToModelMessages(messages)],
    stopWhen: stepCountIs(5),
    tools: toolsAny as any,
  });

  return result.toUIMessageStreamResponse();
}
