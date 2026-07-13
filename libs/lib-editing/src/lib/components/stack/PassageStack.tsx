'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';

import { PassageStackController } from './PassageStackController';
import { StackPassageEditor } from './StackPassageEditor';
import { stackPerf } from './perf';
import { useStackSelection } from './useStackSelection';

/**
 * Overscan on each side of the viewport. With ~8-12 passages visible this
 * keeps roughly 50 editors mounted, per the spike's target window.
 */
const OVERSCAN = 20;

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
      className={cn('h-full overflow-y-auto', className)}
    >
      <div
        className="relative mx-auto w-full max-w-readable px-8"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const uuid = order[item.index];
          const meta = controller.getMeta(uuid);
          if (!meta) return null;
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full px-8"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <StackPassageEditor controller={controller} meta={meta} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
