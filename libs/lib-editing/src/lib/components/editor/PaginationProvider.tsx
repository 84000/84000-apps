'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useState,
  useEffect,
} from 'react';
import { Editor } from '@tiptap/react';
import { TranslationEditorContent } from './TranslationEditor';
import { useBlockEditor, useTranslationExtensions } from './hooks';
import type { XmlFragment } from 'yjs';
import {
  createGraphQLClient,
  getTranslationBlocks,
  getTranslationBlocksAround,
} from '@client-graphql';
import type { PanelFilter } from '@data-access';
import { PassageSkeleton } from '../shared/PassageSkeleton';
import { isUuid, scrollToElement, useIsMobile } from '@lib-utils';
import { PanelName, useNavigation } from '../shared';
import { LotusPond, SHEET_ANIMATION_DURATION } from '@design-system';

const LOADING_SKELETONS_COUNT = 3;
const CHUNK_SIZE = 25;

/**
 * Insert content in chunks with yielding to browser to prevent long frame blocking
 */
const insertContentChunked = async (
  editor: Editor,
  pos: number,
  content: TranslationEditorContent,
) => {
  if (!Array.isArray(content) || content.length <= CHUNK_SIZE) {
    // Small content - insert all at once
    editor.commands.insertContentAt(pos, content);
    return;
  }

  // Insert in chunks to avoid blocking the main thread
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    const chunk = content.slice(i, i + CHUNK_SIZE);
    const insertPos = i === 0 ? pos : editor.state.doc.content.size;
    editor.commands.insertContentAt(insertPos, chunk);

    // Yield to browser between chunks (except after last chunk)
    if (i + CHUNK_SIZE < content.length) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
};

interface PaginationContextState {
  endCursor?: string;
  startCursor?: string;
  editor?: Editor;
}

export const PaginationContext = createContext<PaginationContextState>({});

export const PaginationProvider = ({
  uuid,
  filter,
  panel,
  content,
  fragment,
  isEditable = true,
  onCreate,
  children,
}: {
  uuid: string;
  filter?: PanelFilter;
  panel: PanelName;
  content: TranslationEditorContent;
  fragment?: XmlFragment;
  isEditable?: boolean;
  onCreate?: (params: { editor: Editor }) => void;
  children: ReactNode;
}) => {
  const initialEndCursor = Array.isArray(content)
    ? content.at(-1)?.attrs?.uuid
    : content?.attrs?.uuid;

  const [startCursor, setStartCursor] = useState<string | undefined>();
  const [endCursor, setEndCursor] = useState<string | undefined>(
    initialEndCursor || undefined,
  );
  const [navCursor, setNavCursor] = useState<string | undefined>();
  const processedNavCursorRef = useRef<string | undefined>(undefined);
  const isNavigatingRef = useRef(false);

  const [startIsLoading, setStartIsLoading] = useState(false);
  const [endIsLoading, setEndIsLoading] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const loadMoreAtStartRef = useRef<HTMLDivElement>(null);
  const loadMoreAtEndRef = useRef<HTMLDivElement>(null);
  const childrenDivRef = useRef<HTMLDivElement>(null);
  const shouldLoadMoreAtStartRef = useRef(false);
  const shouldLoadMoreAtEndRef = useRef(false);
  const [loadMoreTrigger, setLoadMoreTrigger] = useState(0);
  const dataClient = createGraphQLClient();

  const { panels, updatePanel, setShowOuterContent } = useNavigation();
  const isMobile = useIsMobile();

  // Extract hash as a primitive value so we only react to actual hash changes,
  // not to every panels object reference change
  const panelHash = panels[panel]?.hash;

  const { extensions } = useTranslationExtensions({
    fragment,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate: ({ editor }) => {
      setEndIsLoading(false);
      setIsEditorReady(true);
      onCreate?.({ editor });
    },
  });

  useEffect(() => {
    setShowOuterContent(!startCursor);
  }, [startCursor, setShowOuterContent]);

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

          // Wait for editor to finish updating
          await new Promise<void>((resolve) => {
            const handleUpdate = () => {
              editor?.off('update', handleUpdate);
              requestAnimationFrame(() => resolve());
            };

            editor?.on('update', handleUpdate);
            editor?.chain().clearContent().setContent(blocks).run();
          });
          setStartCursor(hasMoreBefore && prevCursor ? prevCursor : undefined);
          setEndCursor(hasMoreAfter && nextCursor ? nextCursor : undefined);

          // Wait for React to re-render and update the DOM (remove/add skeletons)
          // by waiting until the element's position stabilizes
          await new Promise<void>((resolve) => {
            let stabilityCount = 0;
            let lastTop = -1;

            const checkStability = () => {
              const el = div.querySelector<HTMLElement>(
                `#${CSS.escape(navCursor)}`,
              );
              if (!el) {
                requestAnimationFrame(checkStability);
                return;
              }

              const currentTop = el.getBoundingClientRect().top;

              // Check if position has stabilized (same for 2 consecutive frames)
              if (currentTop === lastTop) {
                stabilityCount++;
                if (stabilityCount >= 2) {
                  resolve();
                  return;
                }
              } else {
                stabilityCount = 0;
              }

              lastTop = currentTop;
              requestAnimationFrame(checkStability);
            };

            requestAnimationFrame(checkStability);
          });

          element = div.querySelector<HTMLElement>(`#${CSS.escape(navCursor)}`);
        }

        if (!element) {
          return;
        }

        await scrollToElement({ element });

        updatePanel({
          name: panel,
          state: { ...panels[panel], hash: undefined },
        });
      } catch (error) {
        console.error('Navigation failed:', error);
      } finally {
        isNavigatingRef.current = false;
        // Re-trigger load-more check: the observer may have fired while
        // navigation was in progress (sentinel entered view after content
        // was replaced), but the load-more effect was blocked by the
        // isNavigatingRef guard. Bumping the trigger re-evaluates now
        // that navigation is complete.
        setLoadMoreTrigger((c) => c + 1);
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
  ]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // Set up IntersectionObserver only after the editor has created and rendered
  // initial content. isEditorReady flips to true once and stays true, so the
  // observer is created once and never torn down/recreated during page fetches.
  useEffect(() => {
    if (!isEditorReady) return;

    const startEl = loadMoreAtStartRef.current;
    const endEl = loadMoreAtEndRef.current;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === startEl) {
          shouldLoadMoreAtStartRef.current = entry.isIntersecting;
        } else if (entry.target === endEl) {
          shouldLoadMoreAtEndRef.current = entry.isIntersecting;
        }
        if (entry.isIntersecting) {
          setLoadMoreTrigger((c) => c + 1);
        }
      }
    });

    if (startEl) observer.observe(startEl);
    if (endEl) observer.observe(endEl);

    return () => observer.disconnect();
  }, [isEditorReady]);

  useEffect(() => {
    if (
      endIsLoading ||
      !shouldLoadMoreAtEndRef.current ||
      !endCursor ||
      isNavigatingRef.current
    ) {
      return;
    }
    setEndIsLoading(true);

    (async () => {
      const {
        blocks,
        hasMoreAfter: hasMore,
        nextCursor,
      } = await getTranslationBlocks({
        client: dataClient,
        uuid,
        type: filter,
        cursor: endCursor,
      });

      const pos = editor?.state.doc?.content.size;

      if (pos >= 0 && blocks.length && editor) {
        await insertContentChunked(editor, pos, blocks);
      }

      setEndCursor(hasMore && nextCursor ? nextCursor : undefined);
      setEndIsLoading(false);
    })();
  }, [
    uuid,
    filter,
    endIsLoading,
    editor,
    endCursor,
    dataClient,
    loadMoreTrigger,
  ]);

  useEffect(() => {
    if (
      startIsLoading ||
      !shouldLoadMoreAtStartRef.current ||
      !startCursor ||
      isNavigatingRef.current
    ) {
      return;
    }
    setStartIsLoading(true);

    (async () => {
      const { blocks, hasMoreBefore, prevCursor } = await getTranslationBlocks({
        client: dataClient,
        uuid,
        type: filter,
        cursor: startCursor,
        direction: 'backward',
      });

      const pos = 0;

      if (blocks.length && editor?.view?.dom) {
        const editorEl = editor.view.dom;
        const scrollContainer =
          editorEl.closest('[data-panel]') || editorEl.parentElement;
        const previousScrollHeight = scrollContainer?.scrollHeight || 0;
        const previousScrollTop = scrollContainer?.scrollTop || 0;

        // For start insertion, insert all at once to maintain scroll position accuracy.
        // Chunking here would cause scroll jank since we adjust scroll after insertion.
        editor.commands.insertContentAt(pos, blocks);

        requestAnimationFrame(() => {
          const newScrollHeight = scrollContainer?.scrollHeight || 0;
          const deltaHeight = newScrollHeight - previousScrollHeight;
          if (scrollContainer) {
            scrollContainer.scrollTop = previousScrollTop + deltaHeight;
          }
        });
      } else if (blocks.length && editor) {
        // Fallback: insert without scroll preservation when view not ready
        editor.commands.insertContentAt(pos, blocks);
      }

      setStartCursor(hasMoreBefore && prevCursor ? prevCursor : undefined);
      setStartIsLoading(false);
    })();
  }, [
    uuid,
    filter,
    startIsLoading,
    editor,
    startCursor,
    dataClient,
    loadMoreTrigger,
  ]);

  return (
    <PaginationContext.Provider
      value={{
        startCursor,
        endCursor,
        editor,
      }}
    >
      {startCursor && (
        <div className="flex flex-col gap-4 pt-8">
          {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
            <PassageSkeleton key={i} />
          ))}
        </div>
      )}
      <div ref={loadMoreAtStartRef} className="h-0" />
      <div ref={childrenDivRef}>{children}</div>
      <div ref={loadMoreAtEndRef} className="h-0" />
      {endCursor ? (
        <div className="flex flex-col gap-4 pb-8">
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
