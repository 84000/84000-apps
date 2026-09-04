import { act, renderHook } from '@testing-library/react';

import {
  featureFlagOverride,
  useFeatureFlagEnabled,
  useFeatureFlagsReady,
} from './feature-flags';

jest.mock('@posthog/react', () => ({
  useFeatureFlagEnabled: jest.fn(),
  useFeatureFlagPayload: jest.fn(),
  useFeatureFlagVariantKey: jest.fn(),
  usePostHog: jest.fn(),
  PostHogProvider: ({ children }: { children: unknown }) => children,
}));

const posthog = jest.requireMock('@posthog/react') as {
  useFeatureFlagEnabled: jest.Mock;
  useFeatureFlagPayload: jest.Mock;
  usePostHog: jest.Mock;
};

/**
 * The override exists because local dev and CI otherwise resolve flags against
 * the live PostHog project — see the doc comment on `flagOverrides`.
 */
describe('featureFlagOverride', () => {
  const original = process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES;
  const set = (value?: string) => {
    if (value === undefined) delete process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES;
    else process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES = value;
  };

  afterEach(() => set(original));

  it('reports nothing when the variable is unset', () => {
    set(undefined);
    expect(featureFlagOverride('authority-pages')).toBeUndefined();
  });

  it('pins a bare flag on', () => {
    set('authority-pages');
    expect(featureFlagOverride('authority-pages')).toBe(true);
  });

  it('pins a flag off with =false', () => {
    set('authority-pages=false');
    expect(featureFlagOverride('authority-pages')).toBe(false);
  });

  it('leaves flags it does not name alone', () => {
    set('authority-pages');
    expect(featureFlagOverride('show-reader-header')).toBeUndefined();
  });

  it('reads a list, ignoring spacing', () => {
    set(' authority-pages , show-reader-header=false ');
    expect(featureFlagOverride('authority-pages')).toBe(true);
    expect(featureFlagOverride('show-reader-header')).toBe(false);
  });

  it('re-reads when the variable changes', () => {
    set('authority-pages');
    expect(featureFlagOverride('authority-pages')).toBe(true);
    set('authority-pages=false');
    expect(featureFlagOverride('authority-pages')).toBe(false);
  });

  // A flag that cannot be turned off from PostHog is not a feature flag, so a
  // stale value in a deployed environment must not pin one.
  it('is ignored in a production build', () => {
    const previous = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });
    set('authority-pages');

    expect(featureFlagOverride('authority-pages')).toBeUndefined();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: previous,
      configurable: true,
    });
  });
});

describe('useFeatureFlagEnabled', () => {
  const original = process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES;
  const set = (value?: string) => {
    if (value === undefined)
      delete process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES;
    else process.env.NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES = value;
  };

  beforeEach(() => {
    posthog.useFeatureFlagEnabled.mockReset();
    posthog.useFeatureFlagPayload.mockReset();
  });
  afterEach(() => set(original));

  const enabled = (flag: 'authority-pages') =>
    renderHook(() => useFeatureFlagEnabled(flag)).result.current;

  it('follows PostHog when nothing is pinned', () => {
    set(undefined);
    posthog.useFeatureFlagEnabled.mockReturnValue(true);
    posthog.useFeatureFlagPayload.mockReturnValue(undefined);

    expect(enabled('authority-pages')).toBe(true);
  });

  it('turns a flag on that PostHog reports off', () => {
    set('authority-pages');
    posthog.useFeatureFlagEnabled.mockReturnValue(false);
    posthog.useFeatureFlagPayload.mockReturnValue(undefined);

    expect(enabled('authority-pages')).toBe(true);
  });

  it('turns a flag off that PostHog reports on', () => {
    set('authority-pages=false');
    posthog.useFeatureFlagEnabled.mockReturnValue(true);
    posthog.useFeatureFlagPayload.mockReturnValue(undefined);

    expect(enabled('authority-pages')).toBe(false);
  });

  // The `apps` payload is the other thing that silently reports a flag as off
  // locally, so an override has to get past it too.
  it('ignores an apps payload that excludes this application', () => {
    set('authority-pages');
    posthog.useFeatureFlagEnabled.mockReturnValue(true);
    posthog.useFeatureFlagPayload.mockReturnValue({ apps: ['somewhere-else'] });

    expect(enabled('authority-pages')).toBe(true);
  });

  it('still honours the apps payload when nothing is pinned', () => {
    set(undefined);
    posthog.useFeatureFlagEnabled.mockReturnValue(true);
    posthog.useFeatureFlagPayload.mockReturnValue({ apps: ['somewhere-else'] });

    expect(enabled('authority-pages')).toBe(false);
  });
});

describe('useFeatureFlagsReady', () => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  let listener: (() => void) | undefined;

  /** A client that has, or has not, received its flags. */
  const client = (hasLoadedFlags: boolean) => ({
    featureFlags: { hasLoadedFlags },
    onFeatureFlags: (notify: () => void) => {
      listener = notify;
      return () => undefined;
    },
  });

  beforeEach(() => {
    listener = undefined;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    if (key === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = key;
  });

  it('waits while PostHog is configured but has not answered', () => {
    posthog.usePostHog.mockReturnValue(client(false));
    expect(renderHook(() => useFeatureFlagsReady()).result.current).toBe(false);
  });

  it('is ready once the flags arrive', () => {
    posthog.usePostHog.mockReturnValue(client(true));
    expect(renderHook(() => useFeatureFlagsReady()).result.current).toBe(true);
  });

  // Nothing to wait for, so waiting would be a hang.
  it('is ready immediately when PostHog is not configured', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    posthog.usePostHog.mockReturnValue(client(false));
    expect(renderHook(() => useFeatureFlagsReady()).result.current).toBe(true);
  });

  // An ad blocker stops the flags arriving at all; a caller holding a skeleton
  // on this would hold it for good.
  it('gives up waiting after the timeout', () => {
    posthog.usePostHog.mockReturnValue(client(false));
    const { result } = renderHook(() => useFeatureFlagsReady());
    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(true);
  });

  it('survives a missing client', () => {
    posthog.usePostHog.mockReturnValue(undefined);
    expect(renderHook(() => useFeatureFlagsReady()).result.current).toBe(false);
    expect(listener).toBeUndefined();
  });
});
