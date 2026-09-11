'use client';

import type {
  BibliographyEntryItem,
  GlossaryTermInstance,
  Imprint,
  Passage,
  TohokuCatalogEntry,
  Work,
} from '@eightyfourthousand/data-access';
import type { Editor } from '@tiptap/core';
import { createContext, useContext } from 'react';
import { HighlightRange, PanelName, PanelsState, PanelState } from './types';

export interface NavigationState {
  uuid: string;
  imprint?: Imprint;
  /**
   * Whether this is the studio rather than the reader.
   *
   * An application-level fact, and the thing surfaces like the hover cards
   * actually depend on. They used to ask a mounted editor instead, which is a
   * per-instance answer to a per-application question: it made the cards
   * follow wherever an editable editor happened to be rather than whether the
   * work is being edited at all.
   */
  editable: boolean;
  panels: PanelsState;
  toh?: TohokuCatalogEntry;
  showOuterContent: boolean;
  hasTranslationContent: boolean;
  focusMode: boolean;
  /**
   * Character range within the navigation-target passage to highlight, parsed
   * from the `start`/`end` query parameters.
   */
  highlight?: HighlightRange;
  setToh: (toh: TohokuCatalogEntry) => void;
  setShowOuterContent: (withTitles: boolean) => void;
  setHasTranslationContent: (hasTranslationContent: boolean) => void;
  setFocusMode: (focusMode: boolean) => void;
  updatePanel: (params: { name: PanelName; state: PanelState }) => void;
  fetchBibliographyEntry: (
    uuid: string,
  ) => Promise<BibliographyEntryItem | undefined>;
  fetchEndNote: (uuid: string) => Promise<Passage | undefined>;
  fetchGlossaryTerm: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
  fetchPassage: (uuid: string) => Promise<Passage | undefined>;
  fetchWork: (uuid: string) => Promise<Work | undefined>;
  /**
   * An editor for the passage an element sits in, mounting or focusing one if
   * that is what it takes.
   *
   * Only the editing surfaces need this, and only where no editor is mounted
   * already — the passage stack draws most of a work as static HTML. A host
   * that has one editor over everything registers nothing; resolution falls
   * back to the element's own.
   */
  requestEditorFor?: (element: HTMLElement) => Promise<Editor | null>;
  registerEditorRequest: (
    request: ((element: HTMLElement) => Promise<Editor | null>) | null,
  ) => void;
}

export const DEFAULT_PANELS: PanelsState = {
  left: { open: true, tab: 'toc' },
  right: { open: false, tab: 'endnotes' },
  main: { open: true, tab: 'translation' },
};

export const NavigationContext = createContext<NavigationState>({
  uuid: '',
  // The reader is the safe default: a host that says nothing is not the studio.
  editable: false,
  panels: DEFAULT_PANELS,
  showOuterContent: true,
  hasTranslationContent: true,
  focusMode: false,
  updatePanel: () => {
    throw new Error('Not implemented');
  },
  setToh: () => {
    throw new Error('Not implemented');
  },
  setShowOuterContent: () => {
    throw new Error('Not implemented');
  },
  setHasTranslationContent: () => {
    throw new Error('Not implemented');
  },
  setFocusMode: () => {
    throw new Error('Not implemented');
  },
  fetchBibliographyEntry: async () => {
    throw new Error('Not implemented');
  },
  fetchEndNote: async () => {
    throw new Error('Not implemented');
  },
  fetchGlossaryTerm: async () => {
    throw new Error('Not implemented');
  },
  fetchPassage: async () => {
    throw new Error('Not implemented');
  },
  fetchWork: async () => {
    throw new Error('Not implemented');
  },
  registerEditorRequest: () => {
    throw new Error('Not implemented');
  },
});

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useReaderCache must be used within a ReaderCacheProvider');
  }
  return context;
};
