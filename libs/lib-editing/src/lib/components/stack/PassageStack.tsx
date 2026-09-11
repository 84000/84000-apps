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
import { resolveStackLink, STACK_LINK_SELECTOR } from './stack-links';
import { useNavigation } from '../shared/NavigationContext';
import type { PanelName } from '../shared/types';
import type { StackLinkTarget } from './stack-links';

/**
 * Rows rendered in the virtualized window (cheap static HTML tier).
 * Live editors are focus-driven, not scroll-driven — see the controller's
 * live set — so scrolling never mounts or swaps anything.
 */
const OVERSCAN = 20;

const MEASURED_KEYS = new Set(['Enter', 'Backspace', 'Delete']);

/**
 * The scrollable ancestor a stack virtualizes against, or the document.
 *
 * The stack does not own a scroller. Its host already has one — the editor's
 * resizable panel, the sandbox's frame — and creating a second gave it a
 * viewport as tall as its own content: every row counted as visible, so the
 * virtualizer drew all of them and the feed kept fetching the next page
 * because the visible range always reached the end. Fifteen thousand passages,
 * from one `height: 100%` against an auto-height parent.
 */
export const scrollParent = (from: HTMLElement): HTMLElement => {
  let node = from.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.body;
};

/** Frames to keep re-issuing a settled scroll while rows measure. */
const SETTLE_FRAMES = 12;

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
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  // How far the stack sits below the top of that scroller's content — the
  // tabs and titles above it. The virtualizer measures from the scroller, so
  // without this every row is placed a header too high.
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const root = parentRef.current;
    if (!root) return;
    const found = scrollParent(root);
    setScroller(found);
    setScrollMargin(
      root.getBoundingClientRect().top -
        found.getBoundingClientRect().top +
        found.scrollTop,
    );
  }, []);
  const [menuTarget, setMenuTarget] = useState<StackPassageMenuTarget | null>(
    null,
  );
  const closeMenu = useCallback(() => setMenuTarget(null), []);

  const { updatePanel, setToh, toh, registerEditorRequest } = useNavigation();

  // Hover cards are drawn without an editor; their edit actions ask for one.
  // Resolving it here rather than keeping editors mounted is what lets the
  // static tier stay static.
  useEffect(() => {
    registerEditorRequest((element) => {
      const uuid = element.closest<HTMLElement>('[data-stack-passage]')
        ?.dataset['stackPassage'];
      return uuid ? controller.requestEditorFor(uuid) : Promise.resolve(null);
    });
    return () => registerEditorRequest(null);
  }, [controller, registerEditorRequest]);

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

  const virtualizer = useVirtualizer({
    count: order.length,
    getScrollElement: () => scroller,
    estimateSize: (index) => controller.estimateHeight(order[index]),
    overscan,
    getItemKey: (index) => order[index],
    scrollMargin,
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
  useStackDeepLink(controller, panel);

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

      // Content links, before the focus branch below claims the click. A
      // mounted editor handles these from its own mark and node views; a
      // static row has none, so the stack follows them by delegation. It has
      // to happen on mousedown: focusing swaps the row for an editor, and the
      // clicked element is detached before a `click` would reach it.
      const link = resolveStackLink(target, {
        editable: !controller.isReadOnly(),
      });
      if (link) {
        event.preventDefault();
        followLink(link);
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
      controller.focusPassage(start.uuid, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    // Navigation happens on mousedown, but an anchor's own default fires on
    // click — preventing it there is what keeps a static internal link from
    // also loading its href as a page.
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(STACK_LINK_SELECTOR)) event.preventDefault();
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
    };
  }, [controller, followLink]);

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
        // No width of its own: the host already constrains the column, the
        // way it does for the paginated editor.
        className="relative w-full"
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
