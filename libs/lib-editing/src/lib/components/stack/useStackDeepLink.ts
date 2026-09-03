'use client';

import { useEffect, useRef } from 'react';
import {
  clearTextRangeHighlight,
  highlightTextRange,
} from '@eightyfourthousand/lib-utils';

import { useNavigation } from '../shared/NavigationContext';
import type { PanelName } from '../shared/types';
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

/**
 * Scrolls the stack to the passage a deep link names.
 *
 * The link carries a uuid, and the spine window rarely holds it — so this goes
 * through `revealPassage`, which moves the window rather than paging to it.
 * A `?start`/`?end` range paints the same highlight the paginated editor does.
 *
 * The hash is cleared once used, so the same link can be followed twice.
 */
export const useStackDeepLink = (
  controller: PassageStackController,
  panel: PanelName = 'main',
) => {
  const { panels, updatePanel, highlight } = useNavigation();
  const target = panels[panel]?.hash;
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
        }
      } else {
        clearTextRangeHighlight();
      }

      if (cancelled) return;
      finished = true;
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
