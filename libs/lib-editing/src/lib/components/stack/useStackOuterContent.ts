'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useNavigation } from '../shared/NavigationContext';
import type { PassageStackController } from './PassageStackController';

const unsubscribed = () => undefined;

/**
 * Show the titles and imprint above the front matter only while its stack
 * starts at the first front passage — not above a window that a deep link
 * opened part way through it.
 *
 * Pass the front tab's controller, or null for any other tab.
 */
export const useStackOuterContent = (
  controller: PassageStackController | null | undefined,
) => {
  const { setShowOuterContent } = useNavigation();
  const subscribe = useCallback(
    (listener: () => void) => controller?.subscribe(listener) ?? unsubscribed,
    [controller],
  );
  const atTop = useSyncExternalStore(
    subscribe,
    () => !controller?.hasEarlierPassages(),
    () => true,
  );

  useEffect(() => {
    if (controller) setShowOuterContent(atTop);
  }, [controller, atTop, setShowOuterContent]);

  // The default, for whatever draws the front tab next.
  useEffect(() => {
    if (!controller) return;
    return () => setShowOuterContent(true);
  }, [controller, setShowOuterContent]);
};
