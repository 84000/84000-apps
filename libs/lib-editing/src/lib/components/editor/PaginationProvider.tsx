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
  createBrowserClient,
  getTranslationPassages,
  getTranslationPassagesAround,
  PanelFilter,
} from '@data-access';
import { PassageSkeleton } from '../shared/PassageSkeleton';
import { useInView } from 'motion/react';
import { blocksFromTranslationBody } from '../../block';
import { isUuid, scrollToElement, useIsMobile } from '@lib-utils';
import { PanelName, useNavigation } from '../shared';
import { LotusPond, SHEET_ANIMATION_DURATION } from '@design-system';

const LOADING_SKELETONS_COUNT = 3;

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

  const [startIsLoading, setStartIsLoading] = useState(false);
  const [endIsLoading, setEndIsLoading] = useState(true);
  const loadMoreAtStartRef = useRef<HTMLDivElement>(null);
  const loadMoreAtEndRef = useRef<HTMLDivElement>(null);
  const childrenDivRef = useRef<HTMLDivElement>(null);
  const shouldLoadMoreAtStart = useInView(loadMoreAtStartRef);
  const shouldLoadMoreAtEnd = useInView(loadMoreAtEndRef);
  const dataClient = createBrowserClient();

  const { panels, updatePanel, setShowOuterContent } = useNavigation();
  const isMobile = useIsMobile();

  const { extensions } = useTranslationExtensions({
    fragment,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate: ({ editor }) => {
      setEndIsLoading(false);
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

    const hash = panels[panel]?.hash;
    setNavCursor(hash);
  }, [panel, panels]);

  useEffect(() => {
    const div = childrenDivRef.current;
    if (!div || !navCursor || startIsLoading || endIsLoading) {
      return;
    }

    (async () => {
      // On mobile, add a delay to allow panel Sheet animation to complete
      // before attempting to scroll to the element
      if (isMobile) {
        await new Promise((resolve) =>
          setTimeout(resolve, SHEET_ANIMATION_DURATION),
        );
      }

      let element = div.querySelector<HTMLElement>(`#${CSS.escape(navCursor)}`);

      if (!element && isUuid(navCursor)) {
        const {
          passages,
          hasMoreBefore,
          hasMoreAfter,
          prevCursor,
          nextCursor,
        } = await getTranslationPassagesAround({
          client: dataClient,
          uuid,
          type: filter,
          passageUuid: navCursor,
        });

        const nextContent = blocksFromTranslationBody(passages);
        // Wait for editor to finish updating
        await new Promise<void>((resolve) => {
          const handleUpdate = () => {
            editor?.off('update', handleUpdate);
            requestAnimationFrame(() => resolve());
          };

          editor?.on('update', handleUpdate);
          editor?.chain().clearContent().setContent(nextContent).run();
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
    })();
  }, [
    panel,
    uuid,
    filter,
    navCursor,
    startIsLoading,
    endIsLoading,
    panels,
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

  useEffect(() => {
    if (endIsLoading || !shouldLoadMoreAtEnd || !endCursor) {
      return;
    }
    setEndIsLoading(true);

    (async () => {
      const {
        passages,
        hasMoreAfter: hasMore,
        nextCursor,
      } = await getTranslationPassages({
        client: dataClient,
        uuid,
        type: filter,
        cursor: endCursor,
      });

      const nextContent = blocksFromTranslationBody(passages);
      const pos = editor?.state.doc?.content.size;

      if (pos >= 0 && nextContent.length) {
        editor?.commands.insertContentAt(pos, nextContent);
      }

      setEndCursor(hasMore && nextCursor ? nextCursor : undefined);
      setEndIsLoading(false);
    })();
  }, [
    uuid,
    filter,
    endIsLoading,
    editor,
    shouldLoadMoreAtEnd,
    endCursor,
    dataClient,
  ]);

  useEffect(() => {
    if (startIsLoading || !shouldLoadMoreAtStart || !startCursor) {
      return;
    }
    setStartIsLoading(true);

    (async () => {
      const { passages, hasMoreBefore, prevCursor } =
        await getTranslationPassages({
          client: dataClient,
          uuid,
          type: filter,
          cursor: startCursor,
          direction: 'backward',
        });

      const nextContent = blocksFromTranslationBody(passages);
      const pos = 0;

      if (nextContent.length && editor) {
        const editorEl = editor.view.dom;
        const scrollContainer =
          editorEl.closest('[data-panel]') || editorEl.parentElement;
        const previousScrollHeight = scrollContainer?.scrollHeight || 0;
        const previousScrollTop = scrollContainer?.scrollTop || 0;

        editor.commands.insertContentAt(pos, nextContent);

        requestAnimationFrame(() => {
          const newScrollHeight = scrollContainer?.scrollHeight || 0;
          const deltaHeight = newScrollHeight - previousScrollHeight;
          if (scrollContainer) {
            scrollContainer.scrollTop = previousScrollTop + deltaHeight;
          }
        });
      }

      setStartCursor(hasMoreBefore && prevCursor ? prevCursor : undefined);
      setStartIsLoading(false);
    })();
  }, [
    uuid,
    filter,
    startIsLoading,
    editor,
    shouldLoadMoreAtStart,
    startCursor,
    dataClient,
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
