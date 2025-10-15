// hooks/useScrollToHash.js
'use client';

import { DependencyList, useEffect } from 'react';

/** Scrolls to an element matching the URL hash.
 * @param delay Optional delay in milliseconds before scrolling.
 * @param behavior Scroll behavior, either 'auto' or 'smooth'.
 * @param block Vertical alignment, either 'start', 'center', 'end', or 'nearest'.
 * @returns A cleanup function to clear the timeout if delay is used.
 */
export const scrollToHash = ({
  delay = 0,
  behavior = 'auto',
  block = 'start',
}: {
  delay?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}) => {
  const hash = window.location.hash;
  if (!hash) {
    return;
  }

  const scrollToElement = () => {
    const id = hash.replace('#', '');
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({ behavior, block });
    }
  };

  if (delay > 0) {
    const timeoutId = setTimeout(scrollToElement, delay);
    return () => clearTimeout(timeoutId);
  } else {
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(scrollToElement);
  }
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
