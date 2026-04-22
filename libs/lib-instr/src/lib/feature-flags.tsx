'use client';

import {
  useFeatureFlagEnabled as phUseFeatureFlagEnabled,
  useFeatureFlagPayload as phUseFeatureFlagPayload,
  useFeatureFlagVariantKey as phUseFeatureFlagVariantKey,
  PostHogFeatureProps,
} from '@posthog/react';
import { JsonType } from 'posthog-js';
import { useEffect, useState } from 'react';

export type FeatureFlag =
  | 'authority-pages'
  | 'translation-hover-cards'
  | 'studio-header-config'
  | 'show-reader-header'
  | 'show-restriction-warning';

export type FeatureFlagPayload = {
  apps?: string[];
  [key: string]: JsonType;
};

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

export type GatedFeatureProps = PostHogFeatureProps & {
  flag: FeatureFlag;
};

export const GatedFeature = ({ children, flag }: GatedFeatureProps) => {
  const [isClient, setIsClient] = useState(false);
  const enabled = useFeatureFlagEnabled(flag);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
