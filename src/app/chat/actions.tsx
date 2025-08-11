'use server';

import { streamUI } from '@ai-sdk/rsc';
import { openai } from '@ai-sdk/openai';
// import { z } from 'zod';
import React from 'react';

// const Loading = () => (
//   <div style={{ opacity: 0.7, padding: 8 }}>Thinking…</div>
// );

export async function streamMessage(formData: FormData) {
  // console.log('formData',formData)
  const prompt = String(formData.get('prompt') ?? '').trim() || 'Say hello!';
  // console.log('prompt',prompt)
  const result = await streamUI({
    model: openai('gpt-4o'),
    prompt,
    text: ({ content }) => <div>{content}</div>,
  });

  return result.value;
}
