'use client';

import { useState } from 'react';
import { streamComponent } from './actions';

export default function ChatPage() {
  const [input, setInput] = useState('Hello!');
  const [component, setComponent] = useState<React.ReactNode>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          setIsLoading(true);
          try {
            const ui = await streamComponent(input);
            setComponent(ui);
          } finally {
            setIsLoading(false);
          }
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask something..."
          style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button type="submit" disabled={isLoading} style={{ padding: '8px 12px', borderRadius: 6 }}>
          {isLoading ? 'Streaming…' : 'Send'}
        </button>
      </form>

      <div style={{ minHeight: 120, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        {component}
      </div>
    </div>
  );
}
