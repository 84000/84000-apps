// hooks/useScrollToHash.js
'use client';

import { DependencyList, useEffect } from 'react';

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
  }, [isReady, delay, behavior, block, dependencies]);
}
