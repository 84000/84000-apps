'use client';

import { useEffect, useRef } from 'react';
import {
  clearTextRangeHighlight,
  highlightTextRange,
  isUuid,
} from '@eightyfourthousand/lib-utils';

import { useNavigation } from '../shared/NavigationContext';
import {
  DEFAULT_TAB_FOR_PANEL,
  panelForTab,
  type PanelName,
} from '../shared/types';
import type { PassageStackController } from './PassageStackController';

/** How long to wait for the target row to render before giving up. */
const RENDER_TIMEOUT_MS = 2000;

/**
 * The laid-out element with this id. A hidden layout copy can carry the same
 * id, so the first in the document is not necessarily the one on show.
 */
const drawn = (id: string): HTMLElement | undefined =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`[id="${CSS.escape(id)}"]`),
  ).find((el) => el.getClientRects().length > 0);

/** A row's content element, if its drawn copy has one. */
const drawnRow = (uuid: string): HTMLElement | null =>
  drawn(uuid)?.querySelector<HTMLElement>('.passage.is-editable') ?? null;

/** Poll `find` each frame until it returns an element or time runs out. */
const waitForElement = (
  find: () => HTMLElement | null | undefined,
): Promise<HTMLElement | null> =>
  new Promise((resolve) => {
    const deadline = performance.now() + RENDER_TIMEOUT_MS;
    const look = () => {
      const found = find();
      if (found) return resolve(found);
      if (performance.now() > deadline) return resolve(null);
      requestAnimationFrame(look);
    };
    look();
  });

/** How long a painted highlight is kept up while the row settles. */
const SETTLE_MS = 3000;

/** Stops the highlight currently being held, if any. */
let releaseHeld: (() => void) | undefined;

/** The range last painted, so each is painted once whichever stack gets it. */
let paintedRange: { start: number; end: number } | undefined;

/**
 * Keep a highlight on a row while it settles.
 *
 * Right after a reveal the window around the row is still moving: the row's
 * document can be released and hydrated again, which replaces its content
 * (skeleton, then text), and in a long work the row itself can be redrawn.
 * Either collapses a highlight painted over the old text. Repainting into
 * whichever row holds the passage keeps it until the window has settled.
 */
const holdHighlight = (uuid: string, range: { start: number; end: number }) => {
  releaseHeld?.();
  let frame = 0;
  const paint = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const content = drawnRow(uuid);
      if (content) highlightTextRange({ container: content, ...range });
    });
  };
  const observer = new MutationObserver(paint);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setTimeout(() => observer.disconnect(), SETTLE_MS);
  // Not tied to the effect that painted it: clearing the consumed hash
  // re-runs that effect straight away. A newer highlight replaces it.
  releaseHeld = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
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
 * The hash is cleared once used, so the same link can be followed twice. One
 * that is not a passage uuid names an element above the front matter, such as
 * the imprint: the run is moved to its start and the element scrolled to.
 *
 * Which panel to watch follows the view's own tab, because a hash is addressed
 * to a panel and only the stack drawn in that panel can answer it. Defaulting
 * every view to `main` left the endnotes stack watching a panel it is not in:
 * an endnote link opened the tab and nothing scrolled. A host that draws a tab
 * somewhere unusual can still say so.
 */
export const useStackDeepLink = (
  controller: PassageStackController,
  panel: PanelName = panelForTab(controller.getTab()),
  /**
   * Whether this stack is laid out. The hash is consumed once, so a hidden
   * layout copy must leave it to the copy on show, which on mobile mounts
   * later, in the sheet.
   */
  isDrawn = true,
) => {
  const { panels, updatePanel, highlight } = useNavigation();
  // A hash is addressed to the panel's active tab, and every stack drawn in
  // the panel sees it: only the one for that tab answers.
  const tab = controller.getTab();
  // A panel naming no tab shows its default, and only that stack answers:
  // two stacks in one panel would otherwise both take the hash.
  const activeTab = panels[panel]?.tab ?? DEFAULT_TAB_FOR_PANEL[panel];
  const answers =
    !tab ||
    !activeTab ||
    tab === activeTab ||
    (tab === 'translation' && activeTab === 'compare');
  const target = answers && isDrawn ? panels[panel]?.hash : undefined;
  const handled = useRef<string>(undefined);

  useEffect(() => {
    if (!target || handled.current === target) return;
    handled.current = target;

    let cancelled = false;
    let finished = false;
    // One range in the URL, and a link can name a passage in each panel: the
    // main panel's passage takes it.
    const ownsRange = panel === 'main' || !panels.main?.hash;
    const consume = () =>
      updatePanel({
        name: panel,
        state: { ...panels[panel], hash: undefined },
      });
    void (async () => {
      if (!isUuid(target)) {
        // Not a passage, so nothing the server can find. Over the front
        // matter it is something drawn above the run, such as the imprint;
        // elsewhere nothing a stack can answer, so it is only cleared.
        if (tab !== 'front') {
          finished = true;
          consume();
          return;
        }
        await controller.revealStart();
        if (cancelled) return;
        const element = await waitForElement(() => drawn(target));
        if (cancelled) return;
        element?.scrollIntoView({ block: 'start' });
        finished = true;
        consume();
        return;
      }

      const found = await controller.revealPassage(target);
      if (cancelled) return;

      if (found && highlight) {
        // Painted once, so a stack that finishes later can't move it.
        if (ownsRange && paintedRange !== highlight) {
          const content = await waitForElement(() => drawnRow(target));
          if (cancelled) return;
          if (content) {
            paintedRange = highlight;
            highlightTextRange({
              container: content,
              start: highlight.start,
              end: highlight.end,
            });
            holdHighlight(target, highlight);
          }
        }
      } else if (!highlight) {
        releaseHeld?.();
        clearTextRangeHighlight();
        paintedRange = undefined;
      }

      if (cancelled) return;
      finished = true;
      // Kept when the passage wasn't found, so the stack it belongs to can
      // still answer it.
      if (!found) return;
      consume();
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
