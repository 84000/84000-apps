import {
  useFeatureFlagEnabled as phUseFeatureFlagEnabled,
  useFeatureFlagPayload as phUseFeatureFlagPayload,
  useFeatureFlagVariantKey as phUseFeatureFlagVariantKey,
  PostHogFeatureProps,
} from '@posthog/react';
import { JsonType } from 'posthog-js';

export type FeatureFlag = 'authority-pages' | 'translation-hover-cards';

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
  if (!phUseFeatureFlagEnabled(flagKey)) {
    return false;
  }

  const APPLICATION_NAME = process.env.NEXT_PUBLIC_APPLICATION_NAME || '';
  const { apps } = phUseFeatureFlagPayload(flagKey) as FeatureFlagPayload;

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
  const enabled = useFeatureFlagEnabled(flag);
  return enabled ? children : null;
};
