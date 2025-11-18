'use client';

import { DependencyList, useEffect } from 'react';

export const findElementByHash = (): HTMLElement | null => {
  const hash = window.location.hash;
  if (!hash) {
    return null;
  }

  const id = hash.replace('#', '');
  return document.getElementById(id);
};

/** Scrolls to an element matching the URL hash.
 * @param delay Optional delay in milliseconds before scrolling.
 * @param behavior Scroll behavior, either 'auto' or 'smooth'.
 * @param block Vertical alignment, either 'start', 'center', 'end', or 'nearest'.
 * @returns A cleanup function to clear the timeout if delay is used.
 */
export const scrollToHash = async ({
  delay = 0,
  behavior = 'smooth',
  block = 'start',
}: {
  delay?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}) => {
  const element = findElementByHash();
  if (!element) {
    return;
  }

  return new Promise<void>((resolve) => {
    const scrollToElement = () => {
      element.scrollIntoView({ behavior, block });
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );

      resolve();
    };

    if (delay > 0) {
      const timeoutId = setTimeout(scrollToElement, delay);
      return () => clearTimeout(timeoutId);
    } else {
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(scrollToElement);
    }
  });
};

/**
 * Hook that scrolls to an element matching the URL hash.
 * Uses MutationObserver to wait for dynamically loaded content.
 */
export function useScrollToHash({
  isReady,
  delay = 0,
  behavior = 'auto',
  block = 'start',
  dependencies = [],
}: {
  isReady: boolean;
  delay?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  dependencies?: DependencyList;
}) {
  useEffect(() => {
    if (!isReady) {
      return;
    }

    scrollToHash({ delay, behavior, block });
  }, [isReady, delay, behavior, block, dependencies]);
}
