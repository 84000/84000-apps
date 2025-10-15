'use client';

import {
  createBrowserClient,
  getGlossaryInstance,
  getPassage,
  GlossaryTermInstance,
} from '@data-access';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { TranslationEditorContent } from '../editor';
import { blockFromPassage } from '../../block';

interface ReaderCacheState {
  fetchEndNote: (uuid: string) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryTerm: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}

export const ReaderCacheContext = createContext<ReaderCacheState>({
  fetchEndNote: async () => {
    throw new Error('Not implemented');
  },
  fetchGlossaryTerm: async () => {
    throw new Error('Not implemented');
  },
});

export const EntityCacheProvider = ({ children }: { children: ReactNode }) => {
  const client = createBrowserClient();
  const glossaryCache = useRef<{ [uuid: string]: GlossaryTermInstance }>({});
  const endnoteCache = useRef<{ [uuid: string]: TranslationEditorContent }>({});

  const fetchEndNote = useCallback(
    async (uuid: string): Promise<TranslationEditorContent | undefined> => {
      if (!endnoteCache.current) {
        endnoteCache.current = {};
      }

      if (endnoteCache.current[uuid]) {
        return [endnoteCache.current[uuid]];
      }

      const endnote = await getPassage({ client, uuid });
      if (!endnote) {
        return undefined;
      }

      const block = blockFromPassage(endnote);
      endnoteCache.current[uuid] = block;
      return [block];
    },
    [client],
  );

  const fetchGlossaryTerm = useCallback(
    async (uuid: string) => {
      if (!glossaryCache.current) {
        glossaryCache.current = {};
      }

      if (glossaryCache.current[uuid]) {
        return glossaryCache.current[uuid];
      }

      const term = await getGlossaryInstance({ client, uuid });
      if (!term) {
        return undefined;
      }

      glossaryCache.current[uuid] = term;
      return term;
    },
    [client],
  );

  return (
    <ReaderCacheContext.Provider value={{ fetchEndNote, fetchGlossaryTerm }}>
      {children}
    </ReaderCacheContext.Provider>
  );
};

export const useReaderCache = () => {
  const context = useContext(ReaderCacheContext);
  if (!context) {
    throw new Error('useReaderCache must be used within a ReaderCacheProvider');
  }
  return context;
};
