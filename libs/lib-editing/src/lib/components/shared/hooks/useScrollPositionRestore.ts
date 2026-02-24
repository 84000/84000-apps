'use client';

import { MutableRefObject, RefObject, useEffect, useRef } from 'react';

/**
 * Snapshot of the topmost visible passage element: its UUID and how far
 * its top edge is from the viewport top. Used to realign scroll position
 * after a layout change (e.g. tab switch with different content widths).
 */
export interface PassageAnchor {
  uuid: string;
  offsetFromViewport: number;
}

/**
 * Finds the nearest scrollable ancestor of an element,
 * skipping hidden containers (zero clientHeight).
 */
export function findScrollParent(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.clientHeight > 0
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Finds the topmost visible passage element within the scroll container.
 * Passage elements are NodeViewWrappers with `id` attributes (UUIDs).
 */
export function capturePassageAnchor(
  scrollContainer: HTMLElement,
): PassageAnchor | null {
  const passages = scrollContainer.querySelectorAll<HTMLElement>(
    '[data-node-view-wrapper][id]',
  );
  const containerTop = scrollContainer.getBoundingClientRect().top;

  for (const el of passages) {
    const rect = el.getBoundingClientRect();
    // Find the first passage whose bottom is below the container top
    // (i.e. at least partially visible)
    if (rect.bottom > containerTop) {
      return {
        uuid: el.id,
        offsetFromViewport: rect.top - containerTop,
      };
    }
  }
  return null;
}

/**
 * After a tab switch, finds the same passage element by UUID and adjusts
 * scrollTop so it appears at the same viewport offset as before.
 */
export function restorePassageAnchor(
  scrollContainer: HTMLElement,
  anchor: PassageAnchor,
): void {
  // Use querySelectorAll because Translation and Compare can both contain
  // passages with the same UUID. querySelector would return the first
  // (hidden Translation), so we need to find the visible one.
  const candidates = scrollContainer.querySelectorAll<HTMLElement>(
    `[data-node-view-wrapper]#${CSS.escape(anchor.uuid)}`,
  );
  let el: HTMLElement | null = null;
  for (const candidate of candidates) {
    if (candidate.getBoundingClientRect().height > 0) {
      el = candidate;
      break;
    }
  }
  if (!el) return;

  const containerTop = scrollContainer.getBoundingClientRect().top;
  const currentOffset = el.getBoundingClientRect().top - containerTop;
  const delta = currentOffset - anchor.offsetFromViewport;
  scrollContainer.scrollTop += delta;
}

/** Tabs whose content contains passage elements (data-node-view-wrapper). */
const PASSAGE_TABS = ['translation', 'compare'];

export function usePassageAnchorRestore(
  scrollContainerRef: RefObject<HTMLElement | null>,
  activeTab: string | undefined,
): MutableRefObject<PassageAnchor | null> {
  const anchorRef = useRef<PassageAnchor | null>(null);
  const prevTabRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;

    // Only restore when arriving at a passage tab (translation/compare).
    // When switching to front/source, keep the anchor so it's available
    // when the user eventually returns to a passage tab.
    if (!PASSAGE_TABS.includes(activeTab || '')) return;

    const container = scrollContainerRef.current;
    const anchor = anchorRef.current;
    if (!container || !anchor) return;

    // Clear inside rAF, not here — useScrollPositionRestore reads the ref
    // synchronously (in its effect, which runs after this one) to decide
    // whether to skip its own restore.
    requestAnimationFrame(() => {
      anchorRef.current = null;
      restorePassageAnchor(container, anchor);
    });
  }, [activeTab, scrollContainerRef]);

  return anchorRef;
}

/**
 * Normalizes tab names so that tabs which should share scroll position
 * map to the same key (e.g. 'compare' → 'translation').
 */
function normalizeTabKey(tab: string): string {
  if (tab === 'compare') return 'translation';
  return tab;
}

/** Max time (ms) to wait for content to populate before giving up on restore. */
const RESTORE_TIMEOUT = 5000;

/**
 * Module-level storage for scroll positions, keyed by `panelId:tabKey`.
 * Survives component remounts (which happen on tab switches due to the
 * ThreeColumns dual-render architecture).
 */
const scrollPositions = new Map<string, number>();

/**
 * Watches the scroll container for content changes (via MutationObserver) and
 * restores scrollTop once the container has enough height. Returns a cleanup
 * function that tears down the observer and timeout.
 */
function waitForContentAndRestore(
  container: HTMLElement,
  targetScroll: number,
): () => void {
  // Try immediately — content may already be present (non-paginated tabs)
  container.scrollTop = targetScroll;
  if (Math.abs(container.scrollTop - targetScroll) < 2) {
    return () => {};
  }

  let settled = false;

  const cleanup = () => {
    if (settled) return;
    settled = true;
    observer.disconnect();
    clearTimeout(timeout);
  };

  const tryRestore = () => {
    if (settled) return;
    requestAnimationFrame(() => {
      if (settled) return;
      container.scrollTop = targetScroll;
      if (Math.abs(container.scrollTop - targetScroll) < 2) {
        cleanup();
      }
    });
  };

  const observer = new MutationObserver(tryRestore);
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Give up after timeout — content may simply be shorter than the saved position
  const timeout = setTimeout(() => {
    container.scrollTop = targetScroll;
    cleanup();
  }, RESTORE_TIMEOUT);

  return cleanup;
}

/**
 * Saves scroll position when switching away from a tab and restores it
 * when switching back.
 *
 * Scroll positions are stored in a module-level Map (not a ref) so they
 * survive component remounts — which happen on tab switches because the
 * ThreeColumns layout renders main panel children in both mobile and
 * desktop trees.
 *
 * For tabs with async/paginated content (TipTap editor), uses a MutationObserver
 * to wait for enough content to load before restoring the scroll position.
 *
 * @param panelId - Stable identifier for the panel ('main' or 'right')
 * @param scrollContainerRef - Ref to the scrollable container element
 * @param activeTab - The currently active tab name
 * @param hasHash - When true, skips restore to let hash-based scrolling take over
 */
export function useScrollPositionRestore(
  panelId: string,
  scrollContainerRef: RefObject<HTMLElement | null>,
  activeTab: string | undefined,
  hasHash: boolean,
  passageAnchorRef?: RefObject<PassageAnchor | null>,
) {
  const prevTabRef = useRef<string | undefined>(undefined);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const currentKey = normalizeTabKey(activeTab || '');
    const prevKey =
      prevTabRef.current !== undefined
        ? normalizeTabKey(prevTabRef.current)
        : undefined;

    const container = scrollContainerRef.current;

    // Skip hidden containers (mobile layout on desktop viewport)
    if (container && container.clientHeight === 0) {
      prevTabRef.current = activeTab;
      return;
    }

    // Cancel any in-progress restore from a previous tab switch
    cleanupRef.current?.();
    cleanupRef.current = null;

    // Save outgoing tab's scroll position
    if (prevKey !== undefined && prevKey !== currentKey && container) {
      scrollPositions.set(`${panelId}:${prevKey}`, container.scrollTop);
    }

    // Restore incoming tab's scroll position.
    // Skip when a passage anchor is pending AND we're arriving at a passage
    // tab — the passage anchor restore is more accurate (immune to scrollTop
    // clamping from hidden content) and will handle positioning instead.
    const passageAnchorWillRestore =
      !!passageAnchorRef?.current &&
      PASSAGE_TABS.includes(activeTab || '');
    if (prevKey !== currentKey && !hasHash && !passageAnchorWillRestore && container) {
      const saved = scrollPositions.get(`${panelId}:${currentKey}`) ?? 0;
      if (saved === 0) {
        requestAnimationFrame(() => {
          container.scrollTop = 0;
        });
      } else {
        cleanupRef.current = waitForContentAndRestore(container, saved);
      }
    }

    prevTabRef.current = activeTab;
  }, [panelId, activeTab, hasHash, scrollContainerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);
}
