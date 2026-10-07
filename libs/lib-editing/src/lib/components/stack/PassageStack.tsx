'use client';

import { measureElement, useVirtualizer } from '@tanstack/react-virtual';
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
import { StackEnd, StackStart, stackStartPx } from './StackEnd';
import { StaticPassageRow } from './StaticPassageRow';
import { stackPerf } from './perf';
import { useStackDeepLink } from './useStackDeepLink';
import { useStackRowPointer } from './useStackRowPointer';
import { useStackScrollHandler } from './useStackScrollHandler';
import { useStackScroller } from './useStackScroller';
import { useStackSelection } from './useStackSelection';
import { useStackVisibleRange } from './useStackVisibleRange';
import type { StackLinkTarget } from './stack-links';
import { useNavigation } from '../shared/NavigationContext';
import { panelForTab, type PanelName } from '../shared/types';

export { scrollParent } from './useStackScroller';

/**
 * Rows rendered in the virtualized window (cheap static HTML tier).
 * Live editors are focus-driven, not scroll-driven — see the controller's
 * live set — so scrolling never mounts or swaps anything.
 */
const OVERSCAN = 20;

const MEASURED_KEYS = new Set(['Enter', 'Backspace', 'Delete']);

export const PassageStack = ({
  controller,
  className,
  overscan = OVERSCAN,
  panel,
}: {
  controller: PassageStackController;
  className?: string;
  overscan?: number;
  /**
   * The panel this stack is drawn in, for deep links. Defaults to the one its
   * tab belongs to; pass it only for a host that places a tab elsewhere.
   */
  panel?: PanelName;
}) => {
  useSyncExternalStore(
    controller.subscribe,
    controller.getVersion,
    controller.getVersion,
  );
  const order = controller.getOrder();
  const parentRef = useRef<HTMLDivElement>(null);
  const { scroller, scrollMargin } = useStackScroller(parentRef);
  const [menuTarget, setMenuTarget] = useState<StackPassageMenuTarget | null>(
    null,
  );
  const closeMenu = useCallback(() => setMenuTarget(null), []);

  const { updatePanel, setToh, toh, registerEditorRequest, panels } =
    useNavigation();
  // Compare shows the Tibetan source beside each passage of the main panel.
  const drawnIn = panel ?? panelForTab(controller.getTab());
  const compareToh =
    drawnIn === 'main' && panels.main.open && panels.main.tab === 'compare'
      ? (toh ?? '')
      : undefined;

  // Hover cards are drawn without an editor; their edit actions ask for one.
  // Resolving it here rather than keeping editors mounted is what lets the
  // static tier stay static.
  useEffect(
    () =>
      registerEditorRequest((element) => {
        if (!parentRef.current?.contains(element)) return null;
        const uuid = element.closest<HTMLElement>('[data-stack-passage]')
          ?.dataset['stackPassage'];
        return uuid ? controller.requestEditorFor(uuid) : null;
      }),
    [controller, registerEditorRequest],
  );

  // Which Tohoku text is being read decides which rows exist: a work spanning
  // several of them carries passages scoped to one, and toh145 and toh847 each
  // have their own endnote n.10.
  useEffect(() => {
    controller.setActiveToh(toh);
  }, [controller, toh]);
  /**
   * Take a static row's content link, through the panel state rather than the
   * URL — the provider writes the URL from that state, so a link that pushed
   * history directly would be overwritten by the next sync.
   */
  const followLink = useCallback(
    (link: StackLinkTarget) => {
      if (link.kind === 'external') {
        window.open(link.href, '_blank');
        return;
      }
      if (link.toh) setToh(link.toh);
      // The provider reads the highlight range back off the URL, and its own
      // sync preserves whatever else is already there.
      const query = new URLSearchParams(window.location.search);
      query.delete('start');
      query.delete('end');
      if (link.highlight) {
        query.set('start', link.highlight.start);
        query.set('end', link.highlight.end);
      }
      window.history.replaceState(null, '', `?${query.toString()}`);
      updatePanel({
        name: link.panel,
        state: { open: true, tab: link.tab, hash: link.hash },
      });
    },
    [updatePanel, setToh],
  );
  const focusedEditor = controller.getFocusedEditor();
  // A tab's stack can be mounted more than once (the layout keeps a hidden
  // copy), and each copy shares the controller. Only the copy holding the
  // editor draws its menus: two bubble menus would dismiss each other's
  // clicks.
  const menuEditor =
    focusedEditor && parentRef.current?.contains(focusedEditor.view.dom)
      ? focusedEditor
      : null;

  // Room above the first row for the placeholders, inside the list's own
  // coordinates: a prepend that ends the earlier passages removes it in the
  // same render, so nothing below is placed against a stale offset.
  const hasEarlier = order.length > 0 && controller.hasEarlierPassages();
  const [startPx] = useState(stackStartPx);
  const virtualizer = useVirtualizer({
    count: order.length,
    paddingStart: hasEarlier ? startPx : 0,
    getScrollElement: () => scroller,
    estimateSize: (index) => controller.estimateHeight(order[index]),
    overscan,
    getItemKey: (index) => order[index],
    scrollMargin,
    // A tab that isn't showing is `display: none`, and every row in it
    // measures 0. Taking that would collapse the list and drag the shared
    // scroll container with it, so a row that isn't rendered keeps its size.
    measureElement: (element, entry, instance) => {
      if (element.getClientRects().length > 0) {
        return measureElement(element, entry, instance);
      }
      const index = instance.indexFromElement(element);
      return (
        instance.measurementsCache[index]?.size ??
        controller.estimateHeight(order[index])
      );
    },
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

  useStackScrollHandler(controller, virtualizer, scroller);

  // Hydration follows the rows actually being drawn. The loader widens this by
  // its own buffer, so passing the rendered range (overscan included) is what
  // keeps a row's document in memory by the time it is scrolled onto.
  const items = virtualizer.getVirtualItems();
  const firstIndex = items[0]?.index ?? 0;
  const lastIndex = items[items.length - 1]?.index ?? 0;
  useStackVisibleRange(controller, parentRef, {
    count: order.length,
    start: firstIndex,
    end: lastIndex + 1,
  });

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

  // The placeholders can also go with nothing prepended — the earlier read
  // failed or came back empty. Every row then moves up by their height, so
  // the viewport follows, by no more than the part of them scrolled past.
  const placeholderRef = useRef({ shown: hasEarlier, first: firstUuid });
  useLayoutEffect(() => {
    const before = placeholderRef.current;
    placeholderRef.current = { shown: hasEarlier, first: firstUuid };
    if (!before.shown || hasEarlier || before.first !== firstUuid) return;
    if (!scroller) return;
    const passed = scroller.scrollTop - scrollMargin;
    const shift = Math.min(startPx, Math.max(0, passed));
    if (shift > 0) scroller.scrollTop -= shift;
  }, [hasEarlier, firstUuid, scroller, scrollMargin, startPx]);

  useStackSelection(controller);
  useStackDeepLink(controller, panel);

  useStackRowPointer({
    parentRef,
    controller,
    updatePanel,
    followLink,
    setMenuTarget,
  });

  // Bookmarks live in local storage; another tab changing them arrives here.
  useEffect(() => {
    const onStorage = () => controller.refreshBookmarks();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [controller]);

  // Text typed between click and editor mount is buffered and replayed.
  useEffect(() => {
    const onTyping = (event: KeyboardEvent | InputEvent) => {
      if (controller.bufferTyping(event)) event.preventDefault();
    };
    document.addEventListener('keydown', onTyping, true);
    document.addEventListener('beforeinput', onTyping, true);
    return () => {
      document.removeEventListener('keydown', onTyping, true);
      document.removeEventListener('beforeinput', onTyping, true);
    };
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
      className={cn('w-full [overflow-anchor:none]', className)}
    >
      {/*
        One of each for the whole stack, bound to the focused passage: only one
        passage is editable at a time, so a copy per row would watch nothing.
        Keyed so they rebind rather than hold a stale editor — and prefixed, or
        the two keyed siblings would share a key.
      */}
      <TranslationBubbleMenu
        key={`bubble-${controller.getFocusedUuid() ?? 'none'}`}
        editor={menuEditor}
      />
      <StackPassageMenu
        controller={controller}
        target={menuTarget}
        onClose={closeMenu}
      />
      {menuEditor && (
        <MentionAdvancedOverlay
          key={`mention-${controller.getFocusedUuid() ?? 'none'}`}
          editor={menuEditor}
        />
      )}
      <div
        // No width of its own: the host already constrains the column, the
        // way it does for the paginated editor.
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {hasEarlier && <StackStart />}
        {items.map((item) => {
          const uuid = order[item.index];
          const meta = controller.getMeta(uuid);
          if (!meta) return null;
          const asEditor = controller.isLive(uuid);
          const tibetan =
            compareToh === undefined
              ? undefined
              : controller.getTibetan(uuid, compareToh);
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${item.start - scrollMargin}px)`,
              }}
            >
              {asEditor ? (
                <StackPassageEditor
                  controller={controller}
                  meta={meta}
                  focused={controller.getFocusedUuid() === uuid}
                  selected={controller.isSelected(uuid)}
                  tibetan={tibetan}
                />
              ) : (
                <StaticPassageRow
                  controller={controller}
                  meta={meta}
                  selected={controller.isSelected(uuid)}
                  tibetan={tibetan}
                />
              )}
            </div>
          );
        })}
      </div>
      {order.length > 0 && <StackEnd hasMore={controller.hasMorePassages()} />}
    </div>
  );
};
