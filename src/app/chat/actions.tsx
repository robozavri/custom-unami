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
  const toolInstruction = `You are the Umami analytics assistant. You can call tools to fetch real data. 
Available tools: get-active-users, set-active-website. 
When the user asks about analytics for a website or time range, call the appropriate tool. If a websiteId is required, ask the user to set it or call set-active-website. If a tool fails, show the error.`;

  try {
    const result = await streamUI({
      model: openai('gpt-4o'),
      initial: <Loading />,
      prompt: `${toolInstruction}\n\nUser: ${prompt}`,
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
