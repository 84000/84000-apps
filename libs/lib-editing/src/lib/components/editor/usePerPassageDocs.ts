'use client';

import {
  useFeatureFlagEnabled,
  useFeatureFlagsReady,
} from '@eightyfourthousand/lib-instr';

/**
 * Whether this editor draws its passages as a stack, and whether that is
 * settled yet.
 *
 * `enabled` alone is not enough to render on: a flag reads false until its
 * value arrives, and building the paginated editor on that answer means a
 * TipTap instance and a Yjs binding per tab, thrown away a moment later.
 */
export const usePerPassageDocs = () => ({
  enabled: useFeatureFlagEnabled('per-passage-docs'),
  ready: useFeatureFlagsReady(),
});
