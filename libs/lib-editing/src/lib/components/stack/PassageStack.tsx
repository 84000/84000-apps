'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';

import { PassageStackController } from './PassageStackController';
import { StackPassageEditor } from './StackPassageEditor';
import { StaticPassageRow } from './StaticPassageRow';
import { stackPerf } from './perf';
import { useStackSelection } from './useStackSelection';

/**
 * Rows rendered in the virtualized window (cheap static HTML tier).
 */
const OVERSCAN = 20;

/**
 * Rows around the viewport that get live editors once scrolling settles.
 * Live editors are the expensive tier — mounting them during a fast scroll
 * is what makes rows blank out, so new ones only mount at rest.
 */
const EDITOR_OVERSCAN = 8;

const MEASURED_KEYS = new Set([
  'Enter',
  'Backspace',
  'Delete',
]);

export const PassageStack = ({
  controller,
  className,
  overscan = OVERSCAN,
}: {
  controller: PassageStackController;
  className?: string;
  overscan?: number;
}) => {
  useSyncExternalStore(
    controller.subscribe,
    controller.getVersion,
    controller.getVersion,
  );
  const order = controller.getOrder();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: order.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => controller.estimateHeight(order[index]),
    overscan,
    getItemKey: (index) => order[index],
  });

  // Default behavior compensates scrollTop for every first measurement of an
  // above-viewport row. After a deep scrollbar jump the whole overscan is
  // unmeasured, so each compensation scrolls the window onto more unmeasured
  // rows — an endless drift that also pins isScrolling on, which blocks
  // editor mounting. Only adjust while genuinely scrolling upward, where
  // skipping it would make content visibly jump. NOTE: this must be set on
  // the instance — virtual-core reads it as a property, not an option.
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
    item,
    _delta,
    instance,
  ) =>
    item.start < instance.getScrollOffset() &&
    instance.scrollDirection === 'backward';

  useEffect(() => {
    controller.setScrollHandler((index) =>
      virtualizer.scrollToIndex(index, { align: 'auto' }),
    );
    return () => controller.setScrollHandler(null);
  }, [controller, virtualizer]);

  useStackSelection(controller, parentRef);

  // Keystroke-to-paint latency: stamp on keydown, sample after the next
  // frame has painted (double rAF).
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return;
      if (event.key.length !== 1 && !MEASURED_KEYS.has(event.key)) return;
      const start = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          stackPerf.recordKeystroke(performance.now() - start),
        ),
      );
    };

    container.addEventListener('keydown', onKeyDown, true);
    return () => container.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div
      ref={parentRef}
      // overflow-anchor off: Chrome's scroll anchoring chases re-rendering
      // virtual rows after a scrollbar jump, compounding with the
      // virtualizer's own offset math into an endless scroll drift.
      className={cn(
        'h-full overflow-y-auto [overflow-anchor:none]',
        className,
      )}
    >
      <div
        className="relative mx-auto w-full max-w-readable px-8"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const uuid = order[item.index];
          const meta = controller.getMeta(uuid);
          if (!meta) return null;
          const range = virtualizer.range;
          const nearViewport =
            !!range &&
            item.index >= range.startIndex - EDITOR_OVERSCAN &&
            item.index <= range.endIndex + EDITOR_OVERSCAN;
          // Editors already alive stay alive (their content and focus must
          // survive small scrolls); new ones mount only near the viewport
          // and only once scrolling has settled.
          const asEditor =
            controller.getEditor(uuid) !== null ||
            (nearViewport && !virtualizer.isScrolling);
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full px-8"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {asEditor ? (
                <StackPassageEditor controller={controller} meta={meta} />
              ) : (
                <StaticPassageRow controller={controller} meta={meta} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
