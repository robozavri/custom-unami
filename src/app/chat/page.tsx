'use client';

import React, { useState } from 'react';
import { streamMessage } from './actions';

export default function ChatPage() {
  const [component, setComponent] = useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ maxWidth: 760, margin: '24px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Chat</h1>

      <form
        onSubmit={async e => {
          e.preventDefault();
          setSubmitting(true);
          const data = new FormData(e.currentTarget as HTMLFormElement);
          try {
            const node = await streamMessage(data);
            setComponent(node);
          } finally {
            setSubmitting(false);
          }
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        <input
          name="prompt"
          placeholder="Ask anything (e.g., Summarize this text; Show a note)"
          style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }}
        />
        <button
          type="submit"
          disabled={submitting}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #111' }}
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </form>

      <div>{component}</div>
    </div>
  );
}
