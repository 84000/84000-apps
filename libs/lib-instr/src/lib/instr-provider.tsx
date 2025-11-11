import { ReactNode } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';

export const InstrProvider = ({ children }: { children: ReactNode }) => {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
};
