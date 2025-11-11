import posthog from 'posthog-js';

export const initializeInstrumentation = () => {
  const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!POSTHOG_KEY) {
    console.warn('Missing NEXT_PUBLIC_POSTHOG_KEY environment variable');
  }

  if (!POSTHOG_HOST) {
    console.warn('Missing NEXT_PUBLIC_POSTHOG_HOST environment variable');
  }

  const apiHost =
    process.env.NODE_ENV === 'development' ? POSTHOG_HOST : '/relay-ph/';

  if (POSTHOG_KEY && POSTHOG_HOST) {
    posthog.init(POSTHOG_KEY, {
      api_host: apiHost,
      ui_host: POSTHOG_HOST,
      defaults: '2025-05-24',
      person_profiles: 'identified_only',
    });
  }
};
