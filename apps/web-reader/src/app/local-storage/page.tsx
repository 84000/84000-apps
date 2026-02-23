'use client';

import { useEffect } from 'react';

const ALLOWED_ORIGINS = (
  process.env.NEXT_PUBLIC_ALLOWED_ORIGINS ?? ''
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export default function LocalStorageBridge() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        process.env.NODE_ENV === 'production' &&
        !ALLOWED_ORIGINS.includes(event.origin)
      ) {
        return;
      }

      const { action, key, value } = event.data ?? {};

      if (action === 'get' && typeof key === 'string') {
        const raw = localStorage.getItem(key);
        let parsed: unknown = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = raw;
        }
        event.source?.postMessage(
          { key, value: parsed },
          { targetOrigin: event.origin },
        );
      } else if (
        action === 'set' &&
        typeof key === 'string' &&
        value !== undefined
      ) {
        localStorage.setItem(key, JSON.stringify(value));
        event.source?.postMessage(
          { key, success: true },
          { targetOrigin: event.origin },
        );
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return null;
}
