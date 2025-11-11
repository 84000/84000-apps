import { PostHog } from 'posthog-node';

export const createInstrumentationClient = () => {
  const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!POSTHOG_KEY) {
    console.warn('Missing NEXT_PUBLIC_POSTHOG_KEY environment variable');
  }

  if (!POSTHOG_HOST) {
    console.warn('Missing NEXT_PUBLIC_POSTHOG_HOST environment variable');
  }

  if (!POSTHOG_KEY || !POSTHOG_HOST) {
    return;
  }

  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
};
