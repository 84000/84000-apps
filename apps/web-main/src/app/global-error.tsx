'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for errors thrown in the root layout, where a route-level
 * `error.tsx` cannot reach.
 *
 * This is the only boundary that replaces the whole document, so it has to
 * render its own `<html>` and `<body>` — nothing from the root layout survives
 * to wrap it, which is also why it cannot use the design system's providers and
 * styles the way the rest of the app does.
 *
 * Without it, an error at this level renders nothing at all. That is the
 * difference between a bug report saying "the page is blank" and one saying
 * what actually failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unrecoverable application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            84000 Studio could not start
          </h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Something failed before the page could render.
          </p>
          {error.digest && (
            <p
              style={{
                color: '#666',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid #ccc',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
