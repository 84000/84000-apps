'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The scrollable ancestor a stack virtualizes against, or the document.
 *
 * The stack does not own a scroller. Its host already has one — the editor's
 * resizable panel, the sandbox's frame — and creating a second gave it a
 * viewport as tall as its own content: every row counted as visible, so the
 * virtualizer drew all of them and the feed kept fetching the next page
 * because the visible range always reached the end. Fifteen thousand passages,
 * from one `height: 100%` against an auto-height parent.
 */
export const scrollParent = (from: HTMLElement): HTMLElement => {
  let node = from.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.body;
};

/**
 * The scroller a stack virtualizes against, and how far below the top of its
 * content the stack sits.
 */
export const useStackScroller = (
  parentRef: RefObject<HTMLDivElement | null>,
) => {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  // How far the stack sits below the top of that scroller's content — the
  // tabs and titles above it. The virtualizer measures from the scroller, so
  // without this every row is placed a header too high.
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const root = parentRef.current;
    if (!root) return;
    const found = scrollParent(root);
    setScroller(found);

    const measure = () => {
      const next =
        root.getBoundingClientRect().top -
        found.getBoundingClientRect().top +
        found.scrollTop;
      setScrollMargin((current) =>
        Math.abs(current - next) > 0.5 ? next : current,
      );
    };
    measure();

    // What sits above the stack can change height well after mount — a title
    // or an imprint arriving — and this margin is measured from the scroller,
    // so a stale one offsets every row *and* every scroll by that much. It is
    // silent: rows still render and a deep link still scrolls, just to the
    // wrong place. Injecting 260px above a settled stack moved the landing by
    // exactly 260px.
    //
    // Watching the scroller alone is not enough: it reports its own box, not
    // its content's. The things that can move the stack down are its own
    // ancestors up to the scroller, and the scroller's other children.
    const watched = new Set<Element>([found, root]);
    for (
      let node: HTMLElement | null = root;
      node && node !== found;
      node = node.parentElement
    ) {
      watched.add(node);
    }
    Array.from(found.children).forEach((child) => watched.add(child));

    const observer = new ResizeObserver(measure);
    watched.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
    // A ref passed in is as stable as it was inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { scroller, scrollMargin };
};
