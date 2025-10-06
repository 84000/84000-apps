'use client';

import {
  BibliographyEntries,
  createBrowserClient,
  getGlossaryInstance,
  GlossaryTermInstance,
  GlossaryTermInstances,
  Passages,
  Titles,
  Work,
} from '@data-access';
import { createContext, useCallback, useContext, useRef } from 'react';
import { TranslationEditorContent } from '../editor';
import { blockFromPassage } from '../../block';

interface ReaderContextState {
  uuid: string;
  // front matter
  work: Work;
  titles: Titles;
  summary: Passages;
  // main translation
  body: Passages;
  // back matter
  endNotes: Passages;
  glossary: GlossaryTermInstances;
  bibliography: BibliographyEntries;
  fetchEndNote: (uuid: string) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryTerm: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}

export const ReaderContext = createContext<ReaderContextState>({
  uuid: '',
  work: {
    uuid: '',
    title: '',
    pages: 0,
    publicationDate: new Date(),
    publicationVersion: '0.0.0',
    restriction: false,
    toh: [],
  },
  titles: [],
  summary: [],
  body: [],
  endNotes: [],
  glossary: [],
  bibliography: [],
  fetchEndNote: async (_uuid: string) => {
    throw Error('Not implemented');
  },
  fetchGlossaryTerm: async (_uuid: string) => {
    throw Error('Not implemented');
  },
});

interface ReaderContextProps {
  uuid: string;
  work: Work;
  titles: Titles;
  summary: Passages;
  body: Passages;
  endNotes: Passages;
  glossary: GlossaryTermInstances;
  bibliography: BibliographyEntries;
  children: React.ReactNode;
}

export const ReaderProvider = ({
  uuid,
  work,
  titles,
  summary,
  body,
  endNotes,
  glossary,
  bibliography,
  children,
}: ReaderContextProps) => {
  const client = createBrowserClient();
  const glossaryCache = useRef<{ [uuid: string]: GlossaryTermInstance }>(
    glossary.reduce(
      (acc, term) => {
        acc[term.uuid] = term;
        return acc;
      },
      {} as { [uuid: string]: GlossaryTermInstance },
    ),
  );

  const fetchEndNote = useCallback(
    async (uuid: string): Promise<TranslationEditorContent | undefined> => {
      const note = endNotes.find((n) => n.uuid === uuid);
      if (!note) return undefined;
      return blockFromPassage(note);
    },
    [endNotes],
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
    <ReaderContext.Provider
      value={{
        uuid,
        work,
        titles,
        summary,
        body,
        endNotes,
        glossary,
        bibliography,
        fetchEndNote,
        fetchGlossaryTerm,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
};

export const useReader = () => {
  const context = useContext(ReaderContext);
  if (context === undefined) {
    throw new Error('useReaderContext must be used within a ReaderProvider');
  }
  return context;
};
