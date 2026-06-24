'use client';

import { DependencyList, useEffect } from 'react';

/**
 * Finds an element in the document that matches the current URL hash.
 * @returns The HTMLElement if found, otherwise null.
 */
export const findElementByHash = (): HTMLElement | null => {
  const hash = window.location.hash;
  if (!hash) {
    return null;
  }

  const id = hash.replace('#', '');
  return document.getElementById(id);
};

/**
 * Scrolls to a specific element.
 * @param element The target HTMLElement to scroll to.
 * @param delay Optional delay in milliseconds before scrolling.
 * @param behavior Scroll behavior, either 'auto' or 'smooth'.
 * @param block Vertical alignment, either 'start', 'center', 'end', or 'nearest'.
 * @returns A cleanup function to clear the timeout if delay is used.
 */
export const scrollToElement = async ({
  element,
  delay = 0,
  behavior = 'smooth',
  block = 'start',
}: {
  element?: HTMLElement;
  delay?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}) => {
  return new Promise<boolean>((resolve) => {
    if (!element) {
      resolve(false);
      return;
    }

    const scrollToElement = () => {
      element.scrollIntoView({ behavior, block });
      resolve(true);
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
 * Waits for the element with the given id to appear inside `container` and for
 * its vertical position to stabilize before resolving with it.
 *
 * When content is replaced (e.g. a page of paginated terms/passages fetched
 * around a navigation target), the target element's layout keeps shifting for a
 * few frames as skeletons are removed and real content hydrates. Scrolling
 * before it settles lands on a pre-settle position. This polls
 * `getBoundingClientRect().top` and resolves once it is identical across two
 * consecutive frames, capping the wait so a target that never renders can't hang
 * navigation.
 *
 * @param container The scope to query within.
 * @param id The element id to wait for (raw — it is `CSS.escape`d internally).
 * @param maxFrames Maximum frames to wait before giving up (~2s at 60fps).
 * @returns The settled element, or null if it never rendered within the cap.
 */
export const waitForStableElement = (
  container: HTMLElement,
  id: string,
  maxFrames = 120,
): Promise<HTMLElement | null> => {
  return new Promise<HTMLElement | null>((resolve) => {
    let stabilityCount = 0;
    let lastTop = -1;
    let frames = 0;

    const checkStability = () => {
      if (frames++ > maxFrames) {
        resolve(container.querySelector<HTMLElement>(`#${CSS.escape(id)}`));
        return;
      }

      const el = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!el) {
        requestAnimationFrame(checkStability);
        return;
      }

      const currentTop = el.getBoundingClientRect().top;

      // Resolve once the position has been identical for 2 consecutive frames.
      if (currentTop === lastTop) {
        stabilityCount++;
        if (stabilityCount >= 2) {
          resolve(el);
          return;
        }
      } else {
        stabilityCount = 0;
      }

      lastTop = currentTop;
      requestAnimationFrame(checkStability);
    };

    requestAnimationFrame(checkStability);
  });
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

  const success = await scrollToElement({ element, delay, behavior, block });
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );

  return success;
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
