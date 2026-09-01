'use client';

import { Button, H2, H5 } from '@eightyfourthousand/design-system';
import { useEffect } from 'react';

/**
 * Error boundary for the reader route.
 *
 * The reader is composed of three parallel slots (`@left`, `@main`, `@right`)
 * and had no boundary anywhere on the path. A slot that threw took the whole
 * route down to a blank page with nothing rendered and nothing logged, which is
 * indistinguishable from a hang — the symptom that made a Safari-only stall so
 * hard to place. This turns that into something readable.
 *
 * `digest` is the only handle on a server-side error: Next replaces the real
 * message with it in production, and it correlates with the server log entry.
 * Showing it is what makes a production report actionable.
 */
export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Reader route error:', error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="mx-auto max-w-lg text-center">
        <H2 className="text-primary mb-4">This translation failed to load</H2>
        <H5 className="text-secondary mb-6">
          Something went wrong rendering the reader. Reloading may fix it.
        </H5>
        {error.digest && (
          <p className="text-muted-foreground mb-6 font-mono text-sm">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
