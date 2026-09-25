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
  /**
   * The comment thread the reader last asked to look at, by `comments.uuid`.
   *
   * Clicking a comment mark sets it; whatever renders threads beside the
   * passage highlights the match. Provider state rather than a URL write —
   * `NavigationProvider` writes the URL *from* its state, so a manual
   * `pushState` is overwritten by the next sync and never read back.
   */
  focusedComment?: string;
  /**
   * Bumped whenever a comment write lands outside the thread panel. The editor
   * starts and removes threads, and nothing else tells the panel its read is
   * stale.
   */
  commentsRevision: number;
  setToh: (toh: TohokuCatalogEntry) => void;
  setShowOuterContent: (withTitles: boolean) => void;
  setHasTranslationContent: (hasTranslationContent: boolean) => void;
  setFocusMode: (focusMode: boolean) => void;
  updatePanel: (params: { name: PanelName; state: PanelState }) => void;
  setFocusedComment: (uuid?: string) => void;
  /** Tells the thread panel to re-read. */
  refreshComments: () => void;
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
  /**
   * Add a host's editor request, returning its removal. A host returns null
   * for an element it doesn't hold, so several can be registered at once.
   */
  registerEditorRequest: (request: EditorRequestHandler) => () => void;
}

/** Resolves an editor for an element, or null when it isn't the host's. */
export type EditorRequestHandler = (
  element: HTMLElement,
) => Promise<Editor | null> | null;

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
  commentsRevision: 0,
  updatePanel: () => {
    throw new Error('Not implemented');
  },
  setFocusedComment: () => {
    throw new Error('Not implemented');
  },
  refreshComments: () => {
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
  registerEditorRequest: () => () => undefined,
});

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useReaderCache must be used within a ReaderCacheProvider');
  }
  return context;
};
