'use client';

import { useEffect, useRef } from 'react';
import {
  clearTextRangeHighlight,
  highlightTextRange,
} from '@eightyfourthousand/lib-utils';

import { useNavigation } from '../shared/NavigationContext';
import { PANEL_FOR_SECTION, type PanelName } from '../shared/types';
import type { PassageStackController } from './PassageStackController';

/** How long to wait for the target row to render before giving up. */
const RENDER_TIMEOUT_MS = 2000;

/** The row's content element, once the virtualizer has drawn it. */
const waitForRow = (uuid: string): Promise<HTMLElement | null> =>
  new Promise((resolve) => {
    const deadline = performance.now() + RENDER_TIMEOUT_MS;
    const look = () => {
      const content = document
        .getElementById(uuid)
        ?.querySelector<HTMLElement>('.passage.is-editable');
      if (content) return resolve(content);
      if (performance.now() > deadline) return resolve(null);
      requestAnimationFrame(look);
    };
    look();
  });

/** How long a painted highlight is kept up while the row settles. */
const SETTLE_MS = 3000;

/** Stops the highlight currently being held, if any. */
let releaseHeld: (() => void) | undefined;

/**
 * Keep a highlight on a row while it settles.
 *
 * Right after a reveal the window around the row is still moving: the row's
 * document can be released and hydrated again, which replaces its content
 * (skeleton, then text) and collapses a highlight painted over the old text.
 * Repainting on each replacement keeps it until the window has settled.
 */
const holdHighlight = (uuid: string, range: { start: number; end: number }) => {
  releaseHeld?.();
  const row = document.getElementById(uuid);
  if (!row) return;
  const paint = () => {
    const content = row.querySelector<HTMLElement>('.passage.is-editable');
    if (content) highlightTextRange({ container: content, ...range });
  };
  const observer = new MutationObserver(paint);
  observer.observe(row, { childList: true, subtree: true });
  const timer = setTimeout(() => observer.disconnect(), SETTLE_MS);
  // Not tied to the effect that painted it: clearing the consumed hash
  // re-runs that effect straight away. A newer highlight replaces it.
  releaseHeld = () => {
    clearTimeout(timer);
    observer.disconnect();
  };
};

/**
 * Scrolls the stack to the passage a deep link names.
 *
 * The link carries a uuid, and the spine window rarely holds it — so this goes
 * through `revealPassage`, which moves the window rather than paging to it.
 * A `?start`/`?end` range paints the same highlight the paginated editor does.
 *
 * The hash is cleared once used, so the same link can be followed twice.
 *
 * Which panel to watch follows the view's own tab, because a hash is addressed
 * to a panel and only the stack drawn in that panel can answer it. Defaulting
 * every view to `main` left the endnotes stack watching a panel it is not in:
 * an endnote link opened the tab and nothing scrolled. A host that draws a tab
 * somewhere unusual can still say so.
 */
export const useStackDeepLink = (
  controller: PassageStackController,
  panel: PanelName = PANEL_FOR_SECTION[controller.getTab() ?? ''] ?? 'main',
) => {
  const { panels, updatePanel, highlight } = useNavigation();
  // A hash is addressed to the panel's active tab, and every stack drawn in
  // the panel sees it: only the one for that tab answers.
  const tab = controller.getTab();
  const activeTab = panels[panel]?.tab;
  const answers =
    !tab ||
    !activeTab ||
    tab === activeTab ||
    (tab === 'translation' && activeTab === 'compare');
  const target = answers ? panels[panel]?.hash : undefined;
  const handled = useRef<string>(undefined);

  useEffect(() => {
    if (!target || handled.current === target) return;
    handled.current = target;

    let cancelled = false;
    let finished = false;
    void (async () => {
      const found = await controller.revealPassage(target);
      if (cancelled) return;

      if (found && highlight) {
        const content = await waitForRow(target);
        if (cancelled) return;
        if (content) {
          highlightTextRange({
            container: content,
            start: highlight.start,
            end: highlight.end,
          });
          holdHighlight(target, highlight);
        }
      } else {
        releaseHeld?.();
        clearTextRangeHighlight();
      }

      if (cancelled) return;
      finished = true;
      // Kept when the passage wasn't found, so the stack it belongs to can
      // still answer it.
      if (!found) return;
      updatePanel({
        name: panel,
        state: { ...panels[panel], hash: undefined },
      });
    })();

    return () => {
      cancelled = true;
      // StrictMode mounts, tears down and mounts again. A run cancelled part
      // way has moved the spine but not scrolled, so it must not count as
      // handled or the second mount would skip the rest of the work.
      if (!finished) handled.current = undefined;
    };
    // `panels` is read only to preserve the rest of the panel's state when
    // clearing the hash; reacting to it would re-run on every panel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, controller, highlight, panel, updatePanel]);
};
