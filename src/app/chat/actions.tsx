'use server';

import { streamUI } from '@ai-sdk/rsc';
import { openai } from '@ai-sdk/openai';
// import { z } from 'zod';
import React from 'react';
import { chatTools } from './tools';

const Loading = () => <div style={{ opacity: 0.7, padding: 8 }}>Thinking…</div>;

export async function streamMessage(formData: FormData) {
  // console.log('formData',formData)
  const prompt = String(formData.get('prompt') ?? '').trim() || 'Say hello!';
  // console.log('prompt',prompt)
  if (!process.env.OPENAI_API_KEY) {
    return (
      <div style={{ color: '#b91c1c', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
        Missing OPENAI_API_KEY. Set it in your environment and restart the server.
      </div>
    );
  }
  const toolInstruction = `You are an expert website analytics AI assistant for Umami Analytics. Your primary responsibility is to provide precise, data-driven insights based on website analytics data.

## CORE PRINCIPLES:
1. **ALWAYS use analytics tools first** - Never make assumptions or provide generic answers without retrieving actual data
2. **Be precise with numbers** - Always provide exact figures, percentages, and metrics from the data
3. **Data-driven responses only** - Base all conclusions and insights on actual analytics data, not assumptions
4. **Clear data limitations** - If no data exists or events are missing, state this explicitly
5. **Comprehensive analysis** - Use multiple tools when needed to provide complete insights

## RESPONSE REQUIREMENTS:

1. **Always start with data retrieval**: Use appropriate tools to get actual analytics data before answering
2. **Provide exact numbers**: Include specific metrics, percentages, and counts from the data
3. **Include time context**: Always specify the time period being analyzed
4. **Use multiple tools when needed**: Combine tools for comprehensive insights
5. **Highlight data limitations**: If data is missing, sparse, or unavailable, state this clearly
6. **Provide actionable insights**: Translate data into meaningful business recommendations
7. **Include comparisons**: Use previous period data when available for trend analysis
8. **Be specific about methodology**: Explain how you calculated any derived metrics
9. **Always try to return Markdown tables for comparisons/lists, simple charts for trends, and inline callouts (e.g., key numbers, badges) for highlights but always include description text for the data**

## EXAMPLE WORKFLOW:
1. Set active website if not specified
2. Use get-web-statistic for overview metrics
3. Use get-web-analytics-breakdown for trend analysis
4. Use specific tools (get-path-table, get-country-table, etc.) for detailed insights
5. Combine data from multiple tools for comprehensive analysis
6. Present findings with exact numbers and clear insights

Remember: You are an analytics expert. Every answer must be grounded in actual data from the tools. If you cannot retrieve data or if data is insufficient, be explicit about these limitations.`;

  try {
    const result = await streamUI({
      model: openai('gpt-4o'),
      initial: <Loading />,
      system: toolInstruction,
      prompt: prompt,
      // prompt: `\n\nUser: ${prompt}`,
      tools: chatTools as any,
      text: ({ content }) => <div>{content}</div>,
    });

    return result.value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <div style={{ color: '#b91c1c', background: '#fee2e2', padding: 8, borderRadius: 6 }}>
        Request failed: {message}
      </div>
    );
  }
}
