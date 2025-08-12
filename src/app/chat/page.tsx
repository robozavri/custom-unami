'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
          <div
            key={message.id}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: message.role === 'user' ? '#f3f4f6' : '#ffffff',
              border: message.role === 'user' ? '1px solid #e5e7eb' : '1px solid #d1d5db',
              maxWidth: '100%',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: '8px',
                color: message.role === 'user' ? '#374151' : '#1f2937',
              }}
            >
              {message.role === 'user' ? 'You' : 'AI'}
            </div>
            {message.parts.map((part, i) => {
              switch (part.type) {
                case 'text':
                  return (
                    <div key={`${message.id}-${i}`} style={{ lineHeight: '1.6' }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Custom styling for markdown elements
                          h1: ({ children, ...props }) => (
                            <h1
                              style={{
                                fontSize: '1.5em',
                                margin: '16px 0 8px 0',
                                fontWeight: 'bold',
                              }}
                              {...props}
                            >
                              {children}
                            </h1>
                          ),
                          h2: ({ children, ...props }) => (
                            <h2
                              style={{
                                fontSize: '1.3em',
                                margin: '14px 0 6px 0',
                                fontWeight: 'bold',
                              }}
                              {...props}
                            >
                              {children}
                            </h2>
                          ),
                          h3: ({ children, ...props }) => (
                            <h3
                              style={{
                                fontSize: '1.1em',
                                margin: '12px 0 4px 0',
                                fontWeight: 'bold',
                              }}
                              {...props}
                            >
                              {children}
                            </h3>
                          ),
                          p: ({ children, ...props }) => (
                            <p style={{ margin: '8px 0', lineHeight: '1.6' }} {...props}>
                              {children}
                            </p>
                          ),
                          ul: ({ children, ...props }) => (
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }} {...props}>
                              {children}
                            </ul>
                          ),
                          ol: ({ children, ...props }) => (
                            <ol style={{ margin: '8px 0', paddingLeft: '20px' }} {...props}>
                              {children}
                            </ol>
                          ),
                          li: ({ children, ...props }) => (
                            <li style={{ margin: '4px 0' }} {...props}>
                              {children}
                            </li>
                          ),
                          blockquote: ({ children, ...props }) => (
                            <blockquote
                              style={{
                                borderLeft: '4px solid #d1d5db',
                                paddingLeft: '16px',
                                margin: '12px 0',
                                fontStyle: 'italic',
                                color: '#6b7280',
                              }}
                              {...props}
                            >
                              {children}
                            </blockquote>
                          ),
                          code: ({ children, className, ...props }) => {
                            const isInline = !className || !className.includes('language-');
                            return isInline ? (
                              <code
                                style={{
                                  backgroundColor: '#f3f4f6',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  fontSize: '0.9em',
                                }}
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <code
                                style={{
                                  backgroundColor: '#f3f4f6',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  fontFamily: 'monospace',
                                  fontSize: '0.9em',
                                  display: 'block',
                                  overflow: 'auto',
                                }}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          pre: ({ children, ...props }) => (
                            <pre
                              style={{
                                backgroundColor: '#f3f4f6',
                                padding: '12px',
                                borderRadius: '6px',
                                overflow: 'auto',
                                margin: '12px 0',
                              }}
                              {...props}
                            >
                              {children}
                            </pre>
                          ),
                          table: ({ children, ...props }) => (
                            <table
                              style={{
                                borderCollapse: 'collapse',
                                width: '100%',
                                margin: '12px 0',
                              }}
                              {...props}
                            >
                              {children}
                            </table>
                          ),
                          th: ({ children, ...props }) => (
                            <th
                              style={{
                                border: '1px solid #d1d5db',
                                padding: '8px',
                                backgroundColor: '#f9fafb',
                                fontWeight: 'bold',
                              }}
                              {...props}
                            >
                              {children}
                            </th>
                          ),
                          td: ({ children, ...props }) => (
                            <td
                              style={{
                                border: '1px solid #d1d5db',
                                padding: '8px',
                              }}
                              {...props}
                            >
                              {children}
                            </td>
                          ),
                          a: ({ children, ...props }) => (
                            <a
                              style={{
                                color: '#2563eb',
                                textDecoration: 'underline',
                              }}
                              {...props}
                            >
                              {children}
                            </a>
                          ),
                          strong: ({ children, ...props }) => (
                            <strong style={{ fontWeight: 'bold' }} {...props}>
                              {children}
                            </strong>
                          ),
                          em: ({ children, ...props }) => (
                            <em style={{ fontStyle: 'italic' }} {...props}>
                              {children}
                            </em>
                          ),
                          hr: ({ ...props }) => (
                            <hr
                              style={{
                                border: 'none',
                                borderTop: '1px solid #e5e7eb',
                                margin: '16px 0',
                              }}
                              {...props}
                            />
                          ),
                        }}
                      >
                        {part.text}
                      </ReactMarkdown>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
