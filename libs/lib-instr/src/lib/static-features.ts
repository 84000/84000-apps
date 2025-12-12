// NOTE: PostHog does not currently support checking feature flags or remote
// config values during server-side rendering. Until that is supported, we will
// use this hard coded configuration.

export type StaticFeature = 'glossary-attestations';

const STATIC_FEATURE_FLAGS: Record<StaticFeature, string[]> = {
  'glossary-attestations': ['scholars-room'],
};

export const isStaticFeatureEnabled = (flagKey: StaticFeature) => {
  const APPLICATION_NAME = process.env.NEXT_PUBLIC_APPLICATION_NAME || '';

  const apps = STATIC_FEATURE_FLAGS[flagKey] || [];

  if (!apps.length) {
    return true;
  }

  return apps.includes(APPLICATION_NAME);
};
