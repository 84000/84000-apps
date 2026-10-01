'use client';

import { useEffect, useState } from 'react';

/** How long the passage set must settle before a re-read. */
const SETTLE_MS = 250;

/** What a page of passages costs to read comments for at once. */
const MAX_PASSAGES = 100;

/**
 * The passages currently drawn in the body panel, in document order.
 *
 * Read from the DOM rather than from an editor: the passage stack mounts an
 * editor only where focus is and draws everything else as static HTML, and the
 * paginated editor holds all its passages in one document. Both label a passage
 * row with `data-passage-label` and `data-uuid`, which is the contract deep
 * links already resolve against.
 *
 * Debounced, because scrolling a virtualized list changes the set continuously
 * and each change costs a read.
 */
export const useVisiblePassageUuids = (enabled = true): string[] => {
  const [uuids, setUuids] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const read = () => {
      // Every main panel, keeping only rows that are drawn: the layout keeps a
      // hidden copy of the panel, and each panel keeps its inactive tabs
      // mounted but hidden, so the first panel found is often not the one
      // being read.
      const labels = [
        ...document.querySelectorAll(
          '[data-panel="main"] [data-passage-label][data-uuid]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
      const found = [
        ...new Set(
          labels
            .map((el) => el.getAttribute('data-uuid'))
            .filter((uuid): uuid is string => !!uuid),
        ),
      ].slice(0, MAX_PASSAGES);

      setUuids((prev) =>
        prev.length === found.length && prev.every((u, i) => u === found[i])
          ? prev
          : found,
      );
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    };

    read();

    // Rows arrive and leave through DOM mutation in both editors — the stack
    // swaps virtualized rows, the paginated editor replaces its document — so
    // one observer covers scrolling and paging alike.
    const observer = new MutationObserver(schedule);
    // Switching tabs changes only which panel is hidden.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'data-state'],
    });

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return uuids;
};
