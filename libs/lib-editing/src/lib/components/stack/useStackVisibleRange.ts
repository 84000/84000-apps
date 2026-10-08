'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

import type { PassageStackController } from './PassageStackController';

/**
 * Whether a stack's root is laid out, rather than inside a `display: none`
 * tab or the layout copy not in use. False until the first check.
 */
const useStackDrawn = (ref: RefObject<HTMLElement | null>) => {
  const [drawn, setDrawn] = useState(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const check = () => setDrawn(root.getClientRects().length > 0);
    check();
    // Showing or hiding a tab changes the root's box from or to nothing.
    const observer = new ResizeObserver(check);
    observer.observe(root);
    return () => observer.disconnect();
  }, [ref]);

  return drawn;
};

/**
 * Report the rows the virtualizer draws to the controller, which hydrates
 * and pages the spine to follow them — but only while the stack is drawn.
 *
 * A panel's tabs share one scroller, so a hidden stack still reads the shown
 * tab's scroll offset. Following it would page and hydrate a tab nobody is
 * looking at, at whatever depth the other tab is scrolled to.
 *
 * @returns Whether the stack is drawn.
 */
export const useStackVisibleRange = (
  controller: PassageStackController,
  rootRef: RefObject<HTMLElement | null>,
  { count, start, end }: { count: number; start: number; end: number },
) => {
  const drawn = useStackDrawn(rootRef);

  useEffect(() => {
    if (!count || !drawn) return;
    controller.setVisibleRange({ start, end });
  }, [controller, count, start, end, drawn]);

  return drawn;
};
