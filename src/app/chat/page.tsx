'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, isLoading } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 1200,
          width: '100%',
          padding: 16,
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 12, flexShrink: 0 }}>Chat</h1>

        {/* Messages container - scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
            paddingRight: 8, // Add padding for scrollbar
            minHeight: 0, // Important for flexbox scrolling
          }}
        >
          {messages.map(message => (
            <div
              key={message.id}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: message.role === 'user' ? '#f3f4f6' : '#ffffff',
                border: message.role === 'user' ? '1px solid #e5e7eb' : '1px solid #d1d5db',
                maxWidth: '100%',
                flexShrink: 0, // Prevent messages from shrinking
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
          {/* Invisible div for auto-scrolling */}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat form - stuck to bottom */}
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!input.trim()) return;
            sendMessage({ text: input });
            setInput('');
            // Scroll to bottom after sending message
            setTimeout(scrollToBottom, 100);
          }}
          style={{
            display: 'flex',
            gap: 8,
            flexShrink: 0, // Prevent form from shrinking
            paddingTop: 16,
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.currentTarget.value)}
            placeholder="Ask anything (e.g., get-active-users weekly)"
            style={{
              flex: 1,
              padding: 12,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '12px 20px',
              borderRadius: 8,
              border: '1px solid #111',
              backgroundColor: '#111',
              color: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            {isLoading ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
