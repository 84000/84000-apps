'use client';

import { useEffect } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

import type { PassageStackController } from './PassageStackController';

/**
 * Frames of no movement before a settled scroll stops holding its target.
 *
 * Long enough to outlast a re-render, short enough that the anchor releases
 * as soon as the page is genuinely still.
 */
const SETTLE_QUIET_FRAMES = 20;
/** Hard stop, however much keeps arriving. */
const SETTLE_TIMEOUT_MS = 5000;

/**
 * The scroll margin a revealed row keeps above it: the row's own
 * `scroll-mt-20`, or that class's 5rem when the row isn't drawn yet.
 */
const revealMargin = (scroller: HTMLElement | null, uuid?: string) => {
  const row = Array.from(
    scroller?.querySelectorAll<HTMLElement>('[data-stack-passage]') ?? [],
  ).find((element) => element.dataset['stackPassage'] === uuid);
  const drawn = row ? parseFloat(getComputedStyle(row).scrollMarginTop) : NaN;
  if (!Number.isNaN(drawn)) return { margin: drawn, drawn: true };
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { margin: 5 * (Number.isNaN(rem) ? 16 : rem), drawn: false };
};

/** Install the controller's scroll handler: plain, or held until settled. */
export const useStackScrollHandler = (
  controller: PassageStackController,
  virtualizer: Virtualizer<HTMLElement, Element>,
  scroller: HTMLElement | null,
) => {
  useEffect(() => {
    controller.setScrollHandler((index, options) => {
      if (!options?.settle) {
        virtualizer.scrollToIndex(index, { align: 'auto' });
        return;
      }
      // A row is estimated until it is drawn and measured, so scrolling to a
      // target the reader has never passed lands on estimates and drifts as
      // the rows above it settle.
      //
      // Holding for a fixed number of frames is not enough: hydration arrives
      // over hundreds of milliseconds and its last page can land seconds after
      // the scroll, long after a frame budget has run out. Measured on a
      // throttled deep link, the target sat correctly for two seconds and then
      // jumped 912px out of view as the final rows measured.
      //
      // So the anchor is held until the page stops moving rather than for a
      // count, and re-armed by anything that changes the view — a hydration
      // lands as a controller bump. It yields immediately to a reader who
      // scrolls: holding a position against someone trying to leave it is
      // worse than the drift.
      const uuid = controller.getOrder()[index];
      // Keep the row's scroll margin above it, as `scrollIntoView` does for
      // the paginated editor, rather than pinning it to the panel's edge.
      // Read until the row is drawn, then kept: the loop runs every frame.
      let margin: { margin: number; drawn: boolean } | null = null;
      const scrollToReveal = (at: number) => {
        const item = virtualizer.measurementsCache[at];
        if (!item) return virtualizer.scrollToIndex(at, { align: 'start' });
        if (!margin?.drawn) margin = revealMargin(scroller, uuid);
        virtualizer.scrollToOffset(item.start - margin.margin, {
          align: 'start',
        });
      };
      const deadline = performance.now() + SETTLE_TIMEOUT_MS;
      let quiet = 0;
      let lastOffset: number | null = null;
      let lastVersion = controller.getVersion();
      let released = false;

      const release = () => {
        if (released) return;
        released = true;
        scroller?.removeEventListener('wheel', release);
        scroller?.removeEventListener('touchstart', release);
        scroller?.removeEventListener('keydown', release);
      };
      scroller?.addEventListener('wheel', release, { passive: true });
      scroller?.addEventListener('touchstart', release, { passive: true });
      scroller?.addEventListener('keydown', release);

      const again = () => {
        if (released) return;
        if (performance.now() > deadline) return release();

        // Re-derive the row each frame: a prepend moves every index below it,
        // so the number this started with can name a different passage.
        const at = uuid ? controller.getOrder().indexOf(uuid) : index;
        if (at < 0) return release();
        scrollToReveal(at);

        const offset = scroller?.scrollTop ?? null;
        const version = controller.getVersion();
        // Stillness is not the same as being done: between the scroll and the
        // content landing nothing moves, and letting go there is exactly when
        // the drift happens.
        const settled =
          offset === lastOffset &&
          version === lastVersion &&
          !controller.isHydrating();
        if (settled) {
          if (++quiet >= SETTLE_QUIET_FRAMES) return release();
        } else {
          quiet = 0;
        }
        lastOffset = offset;
        lastVersion = version;
        requestAnimationFrame(again);
      };
      again();
    });
    return () => controller.setScrollHandler(null);
  }, [controller, virtualizer, scroller]);
};
