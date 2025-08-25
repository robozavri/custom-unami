import { openai } from '@ai-sdk/openai';
// import { anthropic } from '@ai-sdk/anthropic';
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from 'ai';
import { buildToolsMap } from '@/app/chat/tools/registry';

export const maxDuration = 30;

export async function POST(req: Request) {
  /* eslint-disable no-console */

  // Debug: Log environment variables
  console.log('Environment Debug:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
  console.log('OPENAI_API_KEY starts with:', process.env.OPENAI_API_KEY?.substring(0, 20));
  console.log('NODE_ENV:', process.env.NODE_ENV);

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
    // model: openai('gpt-4o-mini'),
    // model: openai('gpt-5-nano-2025-08-07'),
    model: openai('gpt-5-mini'),
    // model: openai('gpt-5'),
    // model: anthropic('claude-3-haiku-20240307'),
    // model: anthropic('claude-3-5-sonnet-20240620'),
    // model: anthropic('claude-3-5-haiku-latest'),
    // model: anthropic('claude-opus-4-20250514'), // very expensive
    // model: anthropic('claude-sonnet-4-20250514'),
    system: `You are an Umami Analytics Assistant. 
Your role: deliver accurate, non-hallucinated analytics answers.

RULES:
1. Dates:
   • Default → date_from "2025-07-01", date_to "2025-08-31".
   • days = 30 (month) or 365 (year).
   • If user specifies dates → override defaults.
2. Data integrity:
   • Never guess numbers.
   • If data is missing, state it clearly.
3. Output format:
   • Every response MUST include:
       – A strict Markdown table for metrics.
       – At least one guaranteed visual (emoji trend list 📈📉⚠️ or ASCII bars/progress bars).
   • Provide 1–3 concise insights interpreting the data.
4. Workflow:
   • Interpret query intent (traffic, conversions, referrers, retention, etc.).
   • Call the correct Umami tool with date ranges.
   • Present results in table + visual + insights.
5. Style:
   • Concise, professional, supportive.
   • Avoid jargon unless requested.

EXAMPLE:
User: “Show me page views this month.”
Assistant → Call get-page-views with default dates.

Response:
Page Views (Jul–Aug 2025)

| Metric       | Value   | Δ vs Prev. Period |
|--------------|--------:|-------------------|
| Page Views   | 12,540  | 📈 +8%            |
| Users        | 3,420   | 📉 -3%            |

Visual:
Page Views  ████████████████ 12,540  
Users       ████████         3,420  

Insights:
- 📈 Page views rose 8% vs. last period.
- 📉 Unique users fell 3% → higher repeat visits.`,
    //     system: `You are a helpful AI assistant for Umami analytics. When calling any tool that accepts date parameters, ALWAYS pass the current year and current month by default unless the user specifies otherwise.

    // IMPORTANT RULES:
    // 1. For tools that accept date parameters (like get-page-views), always set:
    //    - date_from: current year and month
    //    - date_to: current year and month
    //    - days: 30 (for current month) or 365 (for current year)

    // 2. If the user asks for "current" data, use the current year/month
    // 3. If the user asks for "last month", use the previous month
    // 4. If the user asks for "this year", use the current year

    // 5. Always show tool results in a clear, formatted table when possible.

    // Example: If today is august 2025, and user asks for page views, call get-page-views with date_from: "2025-07-01" and date_to: "2025-08-31"
    // Displaying data in a table is preferred.`,
    messages: [...convertToModelMessages(messages)],
    stopWhen: stepCountIs(5),
    tools: toolsAny as any,
  });

  return result.toUIMessageStreamResponse();
}
