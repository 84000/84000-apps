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
  PanelFilter,
  Passage,
} from '@data-access';
import { PassageSkeleton } from '../shared/PassageSkeleton';
import { useInView } from 'motion/react';
import { blocksFromTranslationBody } from '../../block';
import { useParams } from 'next/navigation';
import { findElementByHash, isUuid } from '@lib-utils';

interface PaginationContextState {
  cursor?: string;
  hasMore: boolean;
  content: TranslationEditorContent;
  editor?: Editor;
}

export const PaginationContext = createContext<PaginationContextState>({
  hasMore: false,
  content: [],
});

export const PaginationProvider = ({
  uuid,
  filter,
  content,
  fragment,
  isEditable = true,
  onCreate,
  fetchEndNote,
  children,
}: {
  uuid: string;
  filter?: PanelFilter;
  content: TranslationEditorContent;
  fragment?: XmlFragment;
  isEditable?: boolean;
  onCreate?: (params: { editor: Editor }) => void;
  fetchEndNote?: (uuid: string) => Promise<Passage | undefined>;
  children: ReactNode;
}) => {
  const initialEndCursor = Array.isArray(content)
    ? content.at(-1)?.attrs?.uuid
    : content?.attrs?.uuid;

  const [startCursor, setStartCursor] = useState<string | undefined>();
  const [endCursor, setEndCursor] = useState<string | undefined>(
    initialEndCursor || undefined,
  );
  const [startIsLoading, setStartIsLoading] = useState(false);
  const [endIsLoading, setEndIsLoading] = useState(true);
  const loadMoreAtStartRef = useRef<HTMLDivElement>(null);
  const loadMoreAtEndRef = useRef<HTMLDivElement>(null);
  const shouldLoadMoreAtStart = useInView(loadMoreAtStartRef);
  const shouldLoadMoreAtEnd = useInView(loadMoreAtEndRef);
  const dataClient = createBrowserClient();

  const params = useParams();

  const { extensions } = useTranslationExtensions({
    fragment,
    fetchEndNote,
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
    const hash = window.location.hash?.substring(1);
    if (!hash || !isUuid(hash)) {
      return;
    }

    const element = findElementByHash();
    if (element) {
      return;
    }

    console.log('No element found for hash:', hash);
  }, [params]);

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
      const { passages, hasMore, nextCursor } = await getTranslationPassages({
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
      const { passages, hasMore, nextCursor } = await getTranslationPassages({
        client: dataClient,
        uuid,
        type: filter,
        cursor: startCursor,
        direction: 'backward',
      });

      const nextContent = blocksFromTranslationBody(passages);
      const pos = 0;

      if (nextContent.length && editor) {
        editor.commands.insertContentAt(pos, nextContent);
      }

      setStartCursor(hasMore && nextCursor ? nextCursor : undefined);
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
        hasMore: false,
        content: [],
        editor,
      }}
    >
      <div ref={loadMoreAtStartRef} className="h-0" />
      {startCursor && (
        <div className="flex flex-col gap-4 pt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <PassageSkeleton key={i} />
          ))}
        </div>
      )}
      {children}
      <div ref={loadMoreAtEndRef} className="h-0" />
      {endCursor ? (
        <div className="flex flex-col gap-4 pb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <PassageSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="h-24" />
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
