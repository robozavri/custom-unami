'use server';

import { streamUI } from '@ai-sdk/rsc';
import { openai } from '@ai-sdk/openai';

export async function streamComponent(prompt: string) {
  const safePrompt = prompt?.trim() || 'Say hello and briefly describe what you can do.';

  try {
    const result = await streamUI({
      model: openai('gpt-4o-mini'),
      prompt: safePrompt,
      text: ({ content }) => <div>{content}</div>,
    });

    return result.value;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return <div style={{ color: 'crimson' }}>Failed to stream component: {message}</div>;
  }
}
