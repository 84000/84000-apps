'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { Editor } from '@tiptap/react';
import { TranslationEditorContent } from './TranslationEditor';
import { useBlockEditor, useTranslationExtensions } from './hooks';
import type { XmlFragment } from 'yjs';
import {
  createGraphQLClient,
  getTranslationBlocksAround,
} from '@eightyfourthousand/client-graphql';
import type { PanelFilter } from '@eightyfourthousand/data-access';
import { PassageSkeleton } from '../shared/PassageSkeleton';
import {
  clearTextRangeHighlight,
  highlightTextRange,
  isUuid,
  scrollToElement,
  useIsMobile,
  waitForFonts,
  waitForStableElement,
} from '@eightyfourthousand/lib-utils';
import { PanelName, TabName, useNavigation } from '../shared';
import {
  LotusPond,
  SHEET_ANIMATION_DURATION,
} from '@eightyfourthousand/design-system';
import { useEditorState } from './EditorProvider';
import { usePaginationLoadTriggers } from '../shared/hooks/usePaginationLoadTriggers';
import { useLoadMoreBlocks } from './useLoadMoreBlocks';

const LOADING_SKELETONS_COUNT = 3;

interface PaginationContextState {
  endCursor?: string;
  startCursor?: string;
  editor?: Editor;
  isEditorReady?: boolean;
}

export const PaginationContext = createContext<PaginationContextState>({});

export const PaginationProvider = ({
  uuid,
  filter,
  panel,
  tab,
  content,
  fragment,
  isEditable = true,
  autofocus = false,
  hasMoreAfter,
  onCreate,
  children,
}: {
  uuid: string;
  filter?: PanelFilter;
  panel: PanelName;
  tab?: TabName;
  content: TranslationEditorContent;
  fragment?: XmlFragment;
  isEditable?: boolean;
  autofocus?: boolean;
  hasMoreAfter?: boolean;
  onCreate?: (params: { editor: Editor }) => void;
  children: ReactNode;
}) => {
  const initialEndCursor = Array.isArray(content)
    ? content.at(-1)?.attrs?.uuid
    : content?.attrs?.uuid;

  const { refreshEditorBaseline, setNavigating } = useEditorState();

  const [startCursor, setStartCursor] = useState<string | undefined>();
  // When the caller knows the initial window already contains everything
  // (`hasMoreAfter === false`), start with no end cursor so the bottom
  // skeleton isn't shown. Otherwise fall back to the last passage's UUID.
  const [endCursor, setEndCursor] = useState<string | undefined>(
    hasMoreAfter === false ? undefined : initialEndCursor || undefined,
  );
  const [navCursor, setNavCursor] = useState<string | undefined>();
  const processedNavCursorRef = useRef<string | undefined>(undefined);
  const isNavigatingRef = useRef(false);

  const [startIsLoading, setStartIsLoading] = useState(false);
  const [endIsLoading, setEndIsLoading] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const childrenDivRef = useRef<HTMLDivElement>(null);
  const handledStartLoadRequestRef = useRef(0);
  const handledEndLoadRequestRef = useRef(0);
  const dataClient = useMemo(() => createGraphQLClient(), []);

  const { panels, updatePanel, setShowOuterContent, highlight } =
    useNavigation();
  const isMobile = useIsMobile();

  // The passage + range currently painted by the deep-link highlight. Held
  // locally (not in nav state / the URL) so it survives the DOM churn from
  // post-navigation editor transactions and is re-applied by the effect below.
  const [activeHighlight, setActiveHighlight] = useState<{
    target: string;
    start: number;
    end: number;
  } | null>(null);

  // Extract hash as a primitive value so we only react to actual hash changes,
  // not to every panels object reference change.
  // When a `tab` is specified, only accept the hash when the panel's active tab
  // matches — this prevents a PaginationProvider for one tab (e.g. endnotes)
  // from reacting to hashes set by a different tab (e.g. glossary).
  const panelHash =
    !tab ||
    panels[panel]?.tab === tab ||
    (tab === 'translation' && panels[panel]?.tab === 'compare')
      ? panels[panel]?.hash
      : undefined;

  const { extensions } = useTranslationExtensions({
    fragment,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    autofocus,
    onCreate: ({ editor }) => {
      setEndIsLoading(false);
      setIsEditorReady(true);
      onCreate?.({ editor });
    },
  });
  const {
    loadMoreAtStartRef,
    loadMoreAtEndRef,
    startLoadRequest,
    endLoadRequest,
  } = usePaginationLoadTriggers({
    enabled: isEditorReady,
    startCursor,
    endCursor,
    startIsLoading,
    endIsLoading,
  });

  useEffect(() => {
    // `showOuterContent` is a single shared flag but only gates front-matter
    // outer content (imprint/titles), so only the front provider should drive
    // it. Otherwise another tab's provider (e.g. the body tab after a deep-link
    // navigation sets its startCursor) would stomp the flag and hide the
    // imprint even when the front matter is at its top.
    if (tab !== 'front') {
      return;
    }
    setShowOuterContent(!startCursor);
  }, [tab, startCursor, setShowOuterContent]);

  useEffect(() => {
    const div = childrenDivRef.current;
    if (!div) {
      return;
    }

    setNavCursor(panelHash);
  }, [panelHash]);

  useEffect(() => {
    const div = childrenDivRef.current;
    if (!div || !navCursor || startIsLoading || endIsLoading) {
      return;
    }

    // Guard: Don't re-process the same hash
    if (processedNavCursorRef.current === navCursor) {
      return;
    }

    // Mark as processing IMMEDIATELY (synchronously) to prevent re-entry
    // from effect re-runs while async work is in progress
    processedNavCursorRef.current = navCursor;

    (async () => {
      isNavigatingRef.current = true;
      setNavigating(true, true, fragment);
      try {
        // On mobile, add a delay to allow panel Sheet animation to complete
        // before attempting to scroll to the element
        if (isMobile) {
          await new Promise((resolve) =>
            setTimeout(resolve, SHEET_ANIMATION_DURATION),
          );
        }

        let element = div.querySelector<HTMLElement>(
          `#${CSS.escape(navCursor)}`,
        );

        if (!element && isUuid(navCursor)) {
          const {
            blocks,
            hasMoreBefore,
            hasMoreAfter,
            prevCursor,
            nextCursor,
          } = await getTranslationBlocksAround({
            client: dataClient,
            uuid,
            type: filter,
            passageUuid: navCursor,
          });

          // Guard: if the UUID doesn't correspond to any passages for this
          // filter (e.g. a cross-tab UUID leaked through), bail out rather
          // than wiping the editor with an empty setContent([]) call.
          if (!blocks || blocks.length === 0) {
            return;
          }

          // Replace the window synchronously. We intentionally do NOT await a
          // TipTap 'update' event here: under the Collaboration (Yjs) extension
          // — loaded only in the editor — TipTap v3 does not reliably emit
          // 'update' for this programmatic clearContent/setContent (core
          // suppresses it when the change arrives via the y-sync plugin or the
          // doc compares equal). Awaiting it would hang navigation indefinitely,
          // leaving isNavigatingRef stuck true and the view locked. The
          // DOM-stability poll below is an event-independent readiness signal.
          editor?.chain().clearContent().setContent(blocks).run();
          setStartCursor(hasMoreBefore && prevCursor ? prevCursor : undefined);
          setEndCursor(hasMoreAfter && nextCursor ? nextCursor : undefined);
          if (tab) {
            refreshEditorBaseline(tab);
          }

          // Let the webfonts land before measuring. The Tibetan face swaps in
          // late and reflows the whole body; measuring before it does gives a
          // stable-looking position that is about to move.
          await waitForFonts();

          // Wait for React to re-render and update the DOM (remove/add
          // skeletons) by waiting until the element's position stabilizes. The
          // wait is capped so a target that never renders can't hang
          // navigation; on timeout the `if (!element) return` below bails
          // cleanly.
          element = await waitForStableElement(div, navCursor);
        }

        if (!element) {
          return;
        }

        // Instant, not smooth. `scrollToElement` resolves when scrollIntoView is
        // *called*, so with a smooth scroll everything below — clearing the hash,
        // painting the highlight, releasing the navigating flag — ran while the
        // animation was still in flight, and `useScrollPositionRestore` was free
        // to write scrollTop into it. Safari's smooth scroll runs longest and
        // aborts outright on a competing write, which is where the misposition
        // came from. There is also no motion worth preserving here: the user
        // arrived by link, not by scrolling.
        await scrollToElement({ element, behavior: 'auto' });

        // Claim this passage as the highlight target when a range is pending,
        // else clear any prior highlight now that we've navigated elsewhere.
        // Painting happens in the effect below (which re-applies after editor
        // DOM churn); a one-shot paint here would be lost to that race.
        setActiveHighlight(
          highlight
            ? { target: navCursor, start: highlight.start, end: highlight.end }
            : null,
        );

        // Now that the range is captured locally, strip it from the URL so it
        // can't re-apply to a different passage on refresh or a later
        // navigation. Done here (the consumption point) rather than in the
        // URL-writing effect, which runs on mount before the range is claimed.
        if (highlight) {
          const stripped = new URLSearchParams(window.location.search);
          stripped.delete('start');
          stripped.delete('end');
          const strippedQuery = stripped.toString();
          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${
              strippedQuery ? `?${strippedQuery}` : ''
            }${window.location.hash}`,
          );
        }

        updatePanel({
          name: panel,
          state: { ...panels[panel], hash: undefined },
        });
      } catch (error) {
        console.error('Navigation failed:', error);
      } finally {
        isNavigatingRef.current = false;
        setNavigating(false);
      }
    })();
  }, [
    panel,
    uuid,
    filter,
    navCursor,
    startIsLoading,
    endIsLoading,
    // Intentionally excluding `panels` - we only read its current value when clearing hash.
    // Including it causes infinite loops since updatePanel() creates a new panels object.
    editor,
    dataClient,
    updatePanel,
    isMobile,
    refreshEditorBaseline,
    setNavigating,
    tab,
    fragment,
    highlight,
  ]);

  // Paints the deep-link highlight and re-applies it on every editor
  // transaction. The CSS Custom Highlight API paints a live Range; ProseMirror
  // transactions that fire after navigation (chrome sync, pagination,
  // decorations) rebuild the passage's text nodes and detach the Range, so a
  // one-shot paint is racy. Re-applying on each `update` keeps it painted; the
  // cleanup clears it when the target changes or the provider unmounts.
  useEffect(() => {
    const div = childrenDivRef.current;
    if (!activeHighlight || !editor || !div) {
      return;
    }

    const { target, start, end } = activeHighlight;
    const apply = () => {
      const passage = div.querySelector<HTMLElement>(`#${CSS.escape(target)}`);
      const content =
        passage?.querySelector<HTMLElement>('.passage.is-editable') ?? passage;
      if (content) {
        highlightTextRange({ container: content, start, end });
      }
    };

    apply();
    editor.on('update', apply);
    return () => {
      editor.off('update', apply);
      clearTextRangeHighlight();
    };
  }, [activeHighlight, editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  useLoadMoreBlocks({
    uuid,
    filter,
    tab,
    editor,
    dataClient,
    startCursor,
    setStartCursor,
    endCursor,
    setEndCursor,
    startIsLoading,
    setStartIsLoading,
    endIsLoading,
    setEndIsLoading,
    startLoadRequest,
    endLoadRequest,
    handledStartLoadRequestRef,
    handledEndLoadRequestRef,
    isNavigatingRef,
    refreshEditorBaseline,
    setNavigating,
  });

  return (
    <PaginationContext.Provider
      value={{
        startCursor,
        endCursor,
        editor,
        isEditorReady,
      }}
    >
      {startCursor && (
        <div className="flex flex-col gap-4 pt-6">
          {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
            <PassageSkeleton key={i} />
          ))}
        </div>
      )}
      <div ref={loadMoreAtStartRef} className="h-0" />
      <div ref={childrenDivRef}>{children}</div>
      <div ref={loadMoreAtEndRef} className="h-0" />
      {endCursor ? (
        <div className="flex flex-col gap-4 pb-8 pt-6">
          {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
            <PassageSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="w-full pt-16 pb-6 @c/sidebar:pt-8">
          <LotusPond className="@c/sidebar:hidden mx-auto w-96" />
        </div>
      )}
    </PaginationContext.Provider>
  );
};

export const usePagination = () => {
  const context = useContext(PaginationContext);

  if (!context) {
    throw new Error('usePagination must be used within a PaginationProvider');
  }

  return context;
};
