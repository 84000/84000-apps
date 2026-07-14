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
 * Live editors are focus-driven, not scroll-driven — see the controller's
 * live set — so scrolling never mounts or swaps anything.
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
    item.start < (instance.scrollOffset ?? 0) &&
    instance.scrollDirection === 'backward';

  useEffect(() => {
    controller.setScrollHandler((index) =>
      virtualizer.scrollToIndex(index, { align: 'auto' }),
    );
    return () => controller.setScrollHandler(null);
  }, [controller, virtualizer]);

  useStackSelection(controller);

  // Click-to-focus on static rows, via delegation so text drags across
  // static content stay plain selections instead of mounting editors.
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const uuidAt = (target: EventTarget | null) =>
      (target instanceof Element ? target : null)?.closest<HTMLElement>(
        '[data-stack-passage]',
      )?.dataset['stackPassage'] ?? null;

    let down: { x: number; y: number; uuid: string | null } | null = null;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[contenteditable="true"]')) {
        down = null; // live editors handle their own caret
        return;
      }
      down = { x: event.clientX, y: event.clientY, uuid: uuidAt(target) };
    };
    const onMouseUp = (event: MouseEvent) => {
      const start = down;
      down = null;
      if (!start?.uuid) return;
      const moved =
        Math.abs(event.clientX - start.x) > 5 ||
        Math.abs(event.clientY - start.y) > 5;
      if (moved || !document.getSelection()?.isCollapsed) return;
      if (uuidAt(event.target) !== start.uuid) return;
      controller.focusPassage(start.uuid, { x: event.clientX, y: event.clientY });
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
    };
  }, [controller]);

  // Keys typed between click and editor mount are buffered and replayed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!controller.hasPendingFocus()) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length === 1) {
        controller.bufferKey(event.key);
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [controller]);

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
          const asEditor = controller.isLive(uuid);
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full px-8"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {asEditor ? (
                <StackPassageEditor
                  controller={controller}
                  meta={meta}
                  focused={controller.getFocusedUuid() === uuid}
                />
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
