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
  useEffect,
  useRef,
  useState,
} from 'react';
import { TranslationEditorContent } from '../editor';
import { blockFromPassage } from '../../block';
import { scrollToHash } from '@lib-utils';
import { useSearchParams } from 'next/navigation';
import {
  PANEL_NAMES,
  PanelName,
  PanelsState,
  PanelState,
  TabName,
} from './types';

interface NavigationState {
  panels: PanelsState;
  updatePanel: (params: { name: PanelName; state: PanelState }) => void;
  createHashLink: (params: {
    panel: string;
    tab: string;
    uuid: string;
  }) => string;
  fetchEndNote: (uuid: string) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryTerm: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}

const DEFAULT_PANELS: PanelsState = {
  // TODO: default to toc when available
  left: { open: true, tab: 'summary' },
  right: { open: true, tab: 'endnotes' },
  main: { open: true, tab: 'translation' },
};

export const NavigationContext = createContext<NavigationState>({
  panels: DEFAULT_PANELS,
  updatePanel: () => {
    throw new Error('Not implemented');
  },
  createHashLink: () => {
    throw new Error('Not implemented');
  },
  fetchEndNote: async () => {
    throw new Error('Not implemented');
  },
  fetchGlossaryTerm: async () => {
    throw new Error('Not implemented');
  },
});

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const client = createBrowserClient();
  const query = useSearchParams();
  const [panels, setPanels] = useState<PanelsState>(DEFAULT_PANELS);
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

  const updatePanel = useCallback(
    ({ name, state }: { name: PanelName; state: PanelState }) => {
      const { open, tab } = state;
      setPanels((prev) => ({
        ...prev,
        [name]: { open, tab },
      }));

      const params = new URLSearchParams(window.location.search);
      const openness = state.open ? 'open' : 'closed';
      params.set(name, `${openness}${tab ? `:${tab}` : ''}`);

      const newUrl = `?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, '', newUrl);
    },
    [],
  );

  const parsePanelParams = useCallback((): PanelsState => {
    const params = new URLSearchParams(window.location.search);
    const result: PanelsState = { ...DEFAULT_PANELS };

    for (const [key, value] of params.entries()) {
      const match = value.match(/^(open|closed)(?::(.+))?$/);
      if (match) {
        const [, state, tab] = match;
        const panelKey = key as PanelName;
        if (!PANEL_NAMES.includes(panelKey)) {
          continue;
        }
        result[panelKey] = {
          open: state === 'open',
          tab: tab as TabName | undefined,
        };
      }
    }

    return result;
  }, []);

  const createHashLink = useCallback(
    ({
      panel,
      tab,
      uuid,
    }: {
      panel: string;
      tab: string;
      uuid: string;
    }): string => {
      const params = new URLSearchParams(window.location.search);
      params.set(panel, `open:${tab}`);
      return `?${params.toString()}#${uuid}`;
    },
    [],
  );

  useEffect(() => {
    if (!window.location.hash) {
      return;
    }

    scrollToHash({
      delay: 1000,
    });
  }, []);

  useEffect(() => {
    const newPanels = parsePanelParams();
    setPanels(newPanels);
    scrollToHash({
      delay: 100,
    });
  }, [query, parsePanelParams]);

  return (
    <NavigationContext.Provider
      value={{
        panels,
        updatePanel,
        createHashLink,
        fetchEndNote,
        fetchGlossaryTerm,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useReaderCache must be used within a ReaderCacheProvider');
  }
  return context;
};
