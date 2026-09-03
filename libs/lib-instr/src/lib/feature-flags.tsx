'use client';

import {
  useFeatureFlagEnabled as phUseFeatureFlagEnabled,
  useFeatureFlagPayload as phUseFeatureFlagPayload,
  useFeatureFlagVariantKey as phUseFeatureFlagVariantKey,
  PostHogFeatureProps,
} from '@posthog/react';
import { JsonType } from 'posthog-js';
import { ReactNode, useSyncExternalStore } from 'react';

export type FeatureFlag =
  | 'authority-pages'
  | 'translation-hover-cards'
  | 'studio-header-config'
  | 'show-reader-header'
  | 'show-restriction-warning'
  | 'per-passage-docs';

export type FeatureFlagPayload = {
  apps?: string[];
  [key: string]: JsonType;
};

let cachedRaw: string | undefined;
let cachedOverrides: Record<string, boolean> = {};

/**
 * Flags pinned by `NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES`, a comma-separated
 * list where `flag` forces it on and `flag=false` forces it off.
 *
 * Local development and tests otherwise resolve flags against the live
 * PostHog project — `next.config.js` proxies `/ingest` in every environment —
 * so what a checkout does depends on remote config nobody can see from the
 * repo, and an anonymous browser makes any percentage rollout a coin flip per
 * profile. An override also bypasses the `apps` payload check below, which is
 * the other thing that silently turns a flag off locally.
 *
 * Ignored in production builds: a flag that cannot be turned off from PostHog
 * is not a feature flag.
 */
const flagOverrides = (): Record<string, boolean> => {
  if (process.env.NODE_ENV === 'production') {
    return {};
  }

  const raw = process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES ?? '';
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedOverrides = Object.fromEntries(
      raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [key, value] = entry.split('=');
          return [key.trim(), value?.trim() !== 'false'];
        }),
    );
  }
  return cachedOverrides;
};

/** Whether a flag is pinned, and to what. `undefined` when it is not. */
export const featureFlagOverride = (
  flagKey: FeatureFlag,
): boolean | undefined => flagOverrides()[flagKey];

/**
 * Checks if a feature flag is enabled for the current application.
 * If the feature flag has an "apps" payload, it checks if the current
 * application is included in that list.
 *
 * @param flagKey - The key of the feature flag to check.
 * @returns True if the feature flag is enabled for the current application, false otherwise.
 */
export const useFeatureFlagEnabled = (flagKey: FeatureFlag): boolean => {
  const isEnabled = phUseFeatureFlagEnabled(flagKey);
  const payload = phUseFeatureFlagPayload(flagKey) as
    | FeatureFlagPayload
    | undefined;

  const override = featureFlagOverride(flagKey);
  if (override !== undefined) {
    return override;
  }

  if (!isEnabled) {
    return false;
  }

  const APPLICATION_NAME = process.env.NEXT_PUBLIC_APPLICATION_NAME || '';
  const apps = payload?.apps;

  if (!apps?.length) {
    return true;
  }

  return apps.includes(APPLICATION_NAME);
};

export const useFeatureFlagPayload = (
  flagKey: FeatureFlag,
): FeatureFlagPayload => {
  return phUseFeatureFlagPayload(flagKey) as FeatureFlagPayload;
};

export const useFeatureFlagVariantKey = (
  flagKey: FeatureFlag,
): string | boolean | undefined => {
  return phUseFeatureFlagVariantKey(flagKey);
};

export type GatedFeatureProps = Omit<
  PostHogFeatureProps,
  'flag' | 'children'
> & {
  flag: FeatureFlag;
  children: ReactNode;
};

// Never changes, so the store never notifies. `getSnapshot` reports true on the
// client and `getServerSnapshot` false during SSR and the hydration render,
// which is the flag this component needs to avoid a hydration mismatch.
const subscribeToNothing = () => () => undefined;
const useIsHydrated = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

export const GatedFeature = ({ children, flag }: GatedFeatureProps) => {
  const isClient = useIsHydrated();
  const enabled = useFeatureFlagEnabled(flag);

  if (!isClient) {
    return null;
  }

  return enabled ? children : null;
};

/**
 * Returns the studio header config payload from PostHog.
 * Returns undefined if the flag is not enabled or has no payload.
 */
export const useStudioHeaderConfig = (): unknown => {
  const enabled = phUseFeatureFlagEnabled('studio-header-config');
  const payload = phUseFeatureFlagPayload('studio-header-config');

  if (!enabled) {
    return undefined;
  }

  return payload;
};
