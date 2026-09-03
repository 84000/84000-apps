'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cn } from '@eightyfourthousand/lib-utils';

import { MentionAdvancedOverlay } from '../editor/extensions/Mention/MentionAdvancedOverlay';
import { TranslationBubbleMenu } from '../editor/menus';
import { PassageStackController } from './PassageStackController';
import { StackPassageEditor } from './StackPassageEditor';
import {
  StackPassageMenu,
  type StackPassageMenuTarget,
} from './StackPassageMenu';
import { StaticPassageRow } from './StaticPassageRow';
import { stackPerf } from './perf';
import { useStackDeepLink } from './useStackDeepLink';
import { useStackSelection } from './useStackSelection';

/**
 * Rows rendered in the virtualized window (cheap static HTML tier).
 * Live editors are focus-driven, not scroll-driven — see the controller's
 * live set — so scrolling never mounts or swaps anything.
 */
const OVERSCAN = 20;

const MEASURED_KEYS = new Set(['Enter', 'Backspace', 'Delete']);

/** Frames to keep re-issuing a settled scroll while rows measure. */
const SETTLE_FRAMES = 12;

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
  const [menuTarget, setMenuTarget] = useState<StackPassageMenuTarget | null>(
    null,
  );
  const closeMenu = useCallback(() => setMenuTarget(null), []);
  const focusedEditor = controller.getFocusedEditor();

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
    controller.setScrollHandler((index, options) => {
      if (!options?.settle) {
        virtualizer.scrollToIndex(index, { align: 'auto' });
        return;
      }
      // A row is estimated until it is drawn and measured, so scrolling to a
      // target the reader has never passed lands on estimates and then drifts
      // as the rows above it settle. Re-issue over the next few frames.
      let attempts = 0;
      const again = () => {
        virtualizer.scrollToIndex(index, { align: 'start' });
        if (attempts++ < SETTLE_FRAMES) requestAnimationFrame(again);
      };
      again();
    });
    return () => controller.setScrollHandler(null);
  }, [controller, virtualizer]);

  // Hydration follows the rows actually being drawn. The loader widens this by
  // its own buffer, so passing the rendered range (overscan included) is what
  // keeps a row's document in memory by the time it is scrolled onto.
  const items = virtualizer.getVirtualItems();
  const firstIndex = items[0]?.index ?? 0;
  const lastIndex = items[items.length - 1]?.index ?? 0;
  useEffect(() => {
    if (!order.length) return;
    controller.setVisibleRange({ start: firstIndex, end: lastIndex + 1 });
  }, [controller, order.length, firstIndex, lastIndex]);

  // Prepending rows shifts every existing one down, so the viewport has to be
  // put back on what the reader was looking at. Upward paging only ever runs
  // from the very top, so re-anchoring the row that used to be first is exact
  // — and going through the virtualizer keeps it consistent with the offsets
  // it just laid out.
  const firstUuid = order[0];
  const previousFirstRef = useRef(firstUuid);
  useLayoutEffect(() => {
    const previous = previousFirstRef.current;
    previousFirstRef.current = firstUuid;
    if (previous === firstUuid) return;

    // A prepend keeps the old first row, further down. `revealPassage` swaps
    // the window for a different set of passages, and that one should land
    // wherever it scrolled to.
    const prepended = order.indexOf(previous);
    if (prepended <= 0) return;
    virtualizer.scrollToIndex(prepended, { align: 'start' });
  }, [firstUuid, order, virtualizer]);

  useStackSelection(controller);
  useStackDeepLink(controller);

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
      down = null;

      // The label is the menu's trigger; the default would move focus.
      const labelEl = target?.closest?.<HTMLElement>('[data-passage-label]');
      if (labelEl) {
        event.preventDefault();
        const rect = labelEl.getBoundingClientRect();
        setMenuTarget({
          uuid: labelEl.dataset['uuid'] ?? '',
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        });
        return;
      }

      if (target?.closest?.('[contenteditable="true"]')) return; // live editors handle their own caret
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
      controller.focusPassage(start.uuid, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
    };
  }, [controller]);

  // Bookmarks live in local storage; another tab changing them arrives here.
  useEffect(() => {
    const onStorage = () => controller.refreshBookmarks();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
      className={cn('h-full overflow-y-auto [overflow-anchor:none]', className)}
    >
      {/*
        One of each for the whole stack, bound to the focused passage: only one
        passage is editable at a time, so a copy per row would watch nothing.
        Keyed so they rebind rather than hold a stale editor — and prefixed, or
        the two keyed siblings would share a key.
      */}
      <TranslationBubbleMenu
        key={`bubble-${controller.getFocusedUuid() ?? 'none'}`}
        editor={focusedEditor}
      />
      <StackPassageMenu
        controller={controller}
        target={menuTarget}
        onClose={closeMenu}
      />
      {focusedEditor && (
        <MentionAdvancedOverlay
          key={`mention-${controller.getFocusedUuid() ?? 'none'}`}
          editor={focusedEditor}
        />
      )}
      <div
        className="relative mx-auto w-full max-w-readable px-8"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((item) => {
          const uuid = order[item.index];
          const meta = controller.getMeta(uuid);
          if (!meta) return null;
          const asEditor = controller.isLive(uuid);
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              // `StackRow` supplies the rest of the left gutter.
              className="absolute left-0 top-0 w-full pl-4 pr-8"
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
