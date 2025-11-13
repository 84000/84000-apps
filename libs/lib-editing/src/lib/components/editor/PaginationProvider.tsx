'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Editor } from '@tiptap/react';
import { TranslationEditorContent } from './TranslationEditor';
import { useBlockEditor, useTranslationExtensions } from './hooks';
import type { XmlFragment } from 'yjs';
import { PanelFilter, Passage } from '@data-access';

interface PaginationContextState {
  cursor?: string;
  hasMore: boolean;
  content: TranslationEditorContent;
  editor?: Editor;
  fetchMore: () => Promise<void>;
}

export const PaginationContext = createContext<PaginationContextState>({
  hasMore: false,
  content: [],
  fetchMore: async () => {
    throw Error('Not implemented');
  },
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
  const { extensions } = useTranslationExtensions({
    fragment,
    fetchEndNote,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate,
  });

  return (
    <PaginationContext.Provider
      value={{
        hasMore: false,
        content: [],
        editor,
        fetchMore: async () => {
          /* TODO */
        },
      }}
    >
      {children}
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
