'use client';

import { Dispatch, RefObject, SetStateAction, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import type { GraphQLClient } from 'graphql-request';
import { getTranslationBlocks } from '@eightyfourthousand/client-graphql';
import type { PanelFilter } from '@eightyfourthousand/data-access';
import { TranslationEditorContent } from './TranslationEditor';
import { useBlockEditor } from './hooks';
import type { TabName } from '../shared';
import { findScrollParent } from '../shared/hooks/useScrollPositionRestore';
import type { EditorContextState } from './editor-context';

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

/** Loads more blocks at either end of the window when a trigger asks. */
export const useLoadMoreBlocks = ({
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
}: {
  uuid: string;
  filter?: PanelFilter;
  tab?: TabName;
  editor: ReturnType<typeof useBlockEditor>['editor'];
  dataClient: GraphQLClient;
  startCursor?: string;
  setStartCursor: Dispatch<SetStateAction<string | undefined>>;
  endCursor?: string;
  setEndCursor: Dispatch<SetStateAction<string | undefined>>;
  startIsLoading: boolean;
  setStartIsLoading: Dispatch<SetStateAction<boolean>>;
  endIsLoading: boolean;
  setEndIsLoading: Dispatch<SetStateAction<boolean>>;
  startLoadRequest: number;
  endLoadRequest: number;
  handledStartLoadRequestRef: RefObject<number>;
  handledEndLoadRequestRef: RefObject<number>;
  isNavigatingRef: RefObject<boolean>;
  refreshEditorBaseline: EditorContextState['refreshEditorBaseline'];
  setNavigating: EditorContextState['setNavigating'];
}) => {
  useEffect(() => {
    if (
      endLoadRequest === 0 ||
      handledEndLoadRequestRef.current === endLoadRequest ||
      endIsLoading ||
      !endCursor ||
      isNavigatingRef.current
    ) {
      return;
    }

    handledEndLoadRequestRef.current = endLoadRequest;
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
        setNavigating(true);
        await insertContentChunked(editor, pos, blocks);
        setNavigating(false);
        if (tab) {
          refreshEditorBaseline(tab);
        }
      }

      setEndCursor(hasMore && nextCursor ? nextCursor : undefined);
      setEndIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs and setters are the provider's, so stable
  }, [
    uuid,
    filter,
    endIsLoading,
    editor,
    endCursor,
    dataClient,
    endLoadRequest,
    refreshEditorBaseline,
    setNavigating,
    tab,
  ]);

  useEffect(() => {
    if (
      startLoadRequest === 0 ||
      handledStartLoadRequestRef.current === startLoadRequest ||
      startIsLoading ||
      !startCursor ||
      isNavigatingRef.current
    ) {
      return;
    }

    handledStartLoadRequestRef.current = startLoadRequest;
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
        // Anchor against the real scrollable ancestor. The main translation
        // panel has no `[data-panel]` element (only the back-matter panel does),
        // so the old `closest('[data-panel]') || parentElement` fell back to the
        // editor's non-scrollable parent — making the scroll adjustment below a
        // no-op, which left the sentinel in view and the viewport jumping on
        // prepend. `findScrollParent` is the same lookup BodyPanel/SourceReader use.
        const scrollContainer = findScrollParent(editorEl);
        const previousScrollHeight = scrollContainer?.scrollHeight || 0;
        const previousScrollTop = scrollContainer?.scrollTop || 0;

        // For start insertion, insert all at once to maintain scroll position accuracy.
        // Chunking here would cause scroll jank since we adjust scroll after insertion.
        setNavigating(true);
        editor.commands.insertContentAt(pos, blocks);
        setNavigating(false);
        if (tab) {
          refreshEditorBaseline(tab);
        }

        requestAnimationFrame(() => {
          const newScrollHeight = scrollContainer?.scrollHeight || 0;
          const deltaHeight = newScrollHeight - previousScrollHeight;
          if (scrollContainer) {
            scrollContainer.scrollTop = previousScrollTop + deltaHeight;
          }
        });
      } else if (blocks.length && editor) {
        // Fallback: insert without scroll preservation when view not ready
        setNavigating(true);
        editor.commands.insertContentAt(pos, blocks);
        setNavigating(false);
        if (tab) {
          refreshEditorBaseline(tab);
        }
      }

      setStartCursor(hasMoreBefore && prevCursor ? prevCursor : undefined);
      setStartIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs and setters are the provider's, so stable
  }, [
    uuid,
    filter,
    startIsLoading,
    editor,
    startCursor,
    dataClient,
    startLoadRequest,
    refreshEditorBaseline,
    setNavigating,
    tab,
  ]);
};
