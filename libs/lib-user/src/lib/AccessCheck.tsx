'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Button, H4, MiniLogo } from '@eightyfourthousand/design-system';

/** How long the loading screen waits before saying the wait is unusual. */
export const SLOW_ACCESS_CHECK_MS = 8000;

const Screen = ({ children }: { children: ReactNode }) => (
  <div className="h-screen flex items-center justify-center bg-surface">
    <div className="max-w-100 p-8 flex flex-col items-center gap-4 text-center">
      {children}
    </div>
  </div>
);

/** Shown while the studio checks who is signed in and what they may open. */
export const AccessCheckLoading = () => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_ACCESS_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen>
      <div role="status" className="flex flex-col items-center gap-4">
        <MiniLogo width={64} className="animate-pulse" />
        <p className="text-sm text-muted-foreground">
          {slow
            ? 'This is taking longer than usual. Still checking your access…'
            : 'Checking your access…'}
        </p>
      </div>
    </Screen>
  );
};

/** Shown when the access check could not get an answer, as opposed to a "no". */
export const AccessCheckFailed = ({
  onRetry,
  onLogout,
}: {
  onRetry: () => void;
  onLogout: () => void;
}) => (
  <Screen>
    <MiniLogo width={64} />
    <H4 className="font-sans font-bold">Couldn’t Check Your Access</H4>
    <p className="text-sm text-muted-foreground">
      The studio couldn’t reach its database to confirm your permissions. This
      is usually temporary.
    </p>
    <div className="flex gap-2">
      <Button onClick={onRetry}>Try again</Button>
      <Button variant="outline" onClick={onLogout}>
        Logout
      </Button>
    </div>
  </Screen>
);
