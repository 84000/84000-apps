'use client';

import type {
  BibliographyEntryItem,
  GlossaryTermInstance,
  Imprint,
  Passage,
  TohokuCatalogEntry,
  Work,
} from '@eightyfourthousand/data-access';
import { createContext, useContext } from 'react';
import { PanelName, PanelsState, PanelState } from './types';

export interface NavigationState {
  uuid: string;
  imprint?: Imprint;
  panels: PanelsState;
  toh?: TohokuCatalogEntry;
  showOuterContent: boolean;
  hasTranslationContent: boolean;
  setToh: (toh: TohokuCatalogEntry) => void;
  setShowOuterContent: (withTitles: boolean) => void;
  setHasTranslationContent: (hasTranslationContent: boolean) => void;
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
}

export const DEFAULT_PANELS: PanelsState = {
  left: { open: true, tab: 'toc' },
  right: { open: false, tab: 'endnotes' },
  main: { open: true, tab: 'translation' },
};

export const NavigationContext = createContext<NavigationState>({
  uuid: '',
  panels: DEFAULT_PANELS,
  showOuterContent: true,
  hasTranslationContent: true,
  updatePanel: () => { throw new Error('Not implemented'); },
  setToh: () => { throw new Error('Not implemented'); },
  setShowOuterContent: () => { throw new Error('Not implemented'); },
  setHasTranslationContent: () => { throw new Error('Not implemented'); },
  fetchBibliographyEntry: async () => { throw new Error('Not implemented'); },
  fetchEndNote: async () => { throw new Error('Not implemented'); },
  fetchGlossaryTerm: async () => { throw new Error('Not implemented'); },
  fetchPassage: async () => { throw new Error('Not implemented'); },
  fetchWork: async () => { throw new Error('Not implemented'); },
});

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useReaderCache must be used within a ReaderCacheProvider');
  }
  return context;
};
