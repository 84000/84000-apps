// NOTE: PostHog does not currently support checking feature flags or remote
// config values during server-side rendering. Until that is supported, we will
// use this hard coded configuration.
//
// A static flag is also the right home for anything that must not depend on a
// network call reaching PostHog at all: an ad blocker or tracking protection
// stops the flags arriving, and `useFeatureFlagEnabled` then reports the
// feature as off. That is fine for a rollout and wrong for a notice we are
// obliged to show.

export type StaticFeature =
  | 'glossary-attestations'
  | 'show-restriction-warning';

/**
 * Which apps a static feature applies to, by `NEXT_PUBLIC_APPLICATION_NAME`.
 *
 * `apps` is an allow list: off everywhere it does not name, including an app
 * that never sets the variable. `exceptApps` is a deny list: on everywhere it
 * does not name. Pick the one whose failure when the variable is missing or
 * misspelled is the safe one.
 */
type StaticFeatureScope = { apps: string[] } | { exceptApps: string[] };

const STATIC_FEATURE_FLAGS: Record<StaticFeature, StaticFeatureScope> = {
  'glossary-attestations': {
    apps: ['scholars-room', 'studio', 'reader-embed'],
  },
  // Suppressed in the editorial apps, whose users are working on these texts.
  // Deny-listed rather than allow-listed so an app that forgets the variable
  // still shows the warning.
  'show-restriction-warning': { exceptApps: ['studio', 'scholars-room'] },
};

export const isStaticFeatureEnabled = (flagKey: StaticFeature) => {
  const APPLICATION_NAME = process.env.NEXT_PUBLIC_APPLICATION_NAME || '';

  const scope = STATIC_FEATURE_FLAGS[flagKey];

  if ('exceptApps' in scope) {
    return !scope.exceptApps.includes(APPLICATION_NAME);
  }

  return scope.apps.includes(APPLICATION_NAME);
};
