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
  const initialCursor = Array.isArray(content)
    ? content.at(-1)?.attrs?.uuid
    : content?.attrs?.uuid;

  const [cursor, setCursor] = useState<string | undefined>(
    initialCursor || undefined,
  );
  const [loading, setLoading] = useState(true);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const shouldLoadMore = useInView(loadMoreRef);
  const dataClient = createBrowserClient();

  const { extensions } = useTranslationExtensions({
    fragment,
    fetchEndNote,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate: ({ editor }) => {
      setLoading(false);
      onCreate?.({ editor });
    },
  });

  useEffect(() => {
    if (loading || !shouldLoadMore || !cursor) {
      return;
    }
    setLoading(true);

    (async () => {
      const { passages, hasMore, nextCursor } = await getTranslationPassages({
        client: dataClient,
        uuid,
        type: filter,
        cursor,
      });

      const nextContent = blocksFromTranslationBody(passages);
      const pos = editor?.state.doc?.content.size;

      if (pos >= 0 && nextContent.length) {
        editor?.commands.insertContentAt(pos, nextContent);
      }

      setCursor(hasMore && nextCursor ? nextCursor : undefined);
      setLoading(false);
    })();
  }, [uuid, filter, loading, editor, shouldLoadMore, cursor, dataClient]);

  return (
    <PaginationContext.Provider
      value={{
        hasMore: false,
        content: [],
        editor,
      }}
    >
      {children}
      <div ref={loadMoreRef} className="h-0" />
      {cursor ? (
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
