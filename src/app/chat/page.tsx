'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, isLoading } = useChat();

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Chat</h1>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput('');
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={input}
          onChange={e => setInput(e.currentTarget.value)}
          placeholder="Ask anything (e.g., get-active-users weekly)"
          style={{
            width: '900px',
            flex: 1,
            padding: 10,
            border: '1px solid #d1d5db',
            borderRadius: 8,
          }}
        />
        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #111' }}
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {messages.map(message => (
          <div key={message.id} style={{ whiteSpace: 'pre-wrap' }}>
            {/* {message.role === 'user' ? 'User: ' : 'AI: '} */}
            {message.parts.map((part, i) => {
              switch (part.type) {
                case 'text':
                  return <div key={`${message.id}-${i}`}>{part.text}</div>;
                default:
                // return (
                //   <pre key={`${message.id}-${i}`} style={{ margin: 0 }}>
                //     {JSON.stringify(part, null, 2)}
                //   </pre>
                // );
              }
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
