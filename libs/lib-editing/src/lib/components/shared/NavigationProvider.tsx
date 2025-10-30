'use client';

import {
  BibliographyEntryItem,
  createBrowserClient,
  getBibliographyEntry,
  getGlossaryInstance,
  getPassage,
  getTranslationImprint,
  getTranslationMetadataByUuid,
  GlossaryTermInstance,
  Imprint,
  Passage,
  TohokuCatalogEntry,
  Work,
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
import { scrollToHash } from '@lib-utils';
import { useSearchParams } from 'next/navigation';
import {
  PANEL_NAMES,
  PanelName,
  PanelsState,
  PanelState,
  TabName,
} from './types';
import { HoverCardProvider } from './HoverCardProvider';

interface NavigationState {
  uuid: string;
  imprint?: Imprint;
  panels: PanelsState;
  toh?: TohokuCatalogEntry;
  setToh: (toh: TohokuCatalogEntry) => void;
  updatePanel: (params: { name: PanelName; state: PanelState }) => void;
  createHashLink: (params: {
    panel: string;
    tab: string;
    uuid: string;
  }) => string;
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

const DEFAULT_PANELS: PanelsState = {
  left: { open: true, tab: 'toc' },
  right: { open: true, tab: 'endnotes' },
  main: { open: true, tab: 'translation' },
};

export const NavigationContext = createContext<NavigationState>({
  uuid: '',
  panels: DEFAULT_PANELS,
  updatePanel: () => {
    throw new Error('Not implemented');
  },
  setToh: () => {
    throw new Error('Not implemented');
  },
  createHashLink: () => {
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
});

export const NavigationProvider = ({
  uuid,
  children,
}: {
  uuid: string;
  children: ReactNode;
}) => {
  const client = createBrowserClient();
  const query = useSearchParams();
  const [panels, setPanels] = useState<PanelsState>(DEFAULT_PANELS);
  const [toh, setToh] = useState<TohokuCatalogEntry | undefined>();
  const [imprint, setImprint] = useState<Imprint | undefined>();
  const bibliographyCache = useRef<{ [uuid: string]: BibliographyEntryItem }>(
    {},
  );
  const endnoteCache = useRef<{ [uuid: string]: Passage }>({});
  const glossaryCache = useRef<{ [uuid: string]: GlossaryTermInstance }>({});
  const passageCache = useRef<{ [uuid: string]: Passage }>({});
  const workCache = useRef<{ [uuid: string]: Work }>({});

  const fetchBibliographyEntry = useCallback(
    async (uuid: string): Promise<BibliographyEntryItem | undefined> => {
      if (!bibliographyCache.current) {
        bibliographyCache.current = {};
      }

      if (bibliographyCache.current[uuid]) {
        return bibliographyCache.current[uuid];
      }

      const entry = await getBibliographyEntry({ client, uuid });
      if (!entry) {
        return undefined;
      }

      bibliographyCache.current[uuid] = entry;
      return entry;
    },
    [client],
  );

  const fetchEndNote = useCallback(
    async (uuid: string): Promise<Passage | undefined> => {
      if (!endnoteCache.current) {
        endnoteCache.current = {};
      }

      if (endnoteCache.current[uuid]) {
        return endnoteCache.current[uuid];
      }

      const endnote = await getPassage({ client, uuid });
      if (!endnote) {
        return undefined;
      }

      endnoteCache.current[uuid] = endnote;
      return endnote;
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

  const fetchPassage = useCallback(
    async (uuid: string): Promise<Passage | undefined> => {
      if (!passageCache.current) {
        passageCache.current = {};
      }

      if (passageCache.current[uuid]) {
        return passageCache.current[uuid];
      }

      const passage = await getPassage({ client, uuid });
      if (!passage) {
        return undefined;
      }

      passageCache.current[uuid] = passage;
      return passage;
    },
    [client],
  );

  const fetchWork = useCallback(
    async (uuid: string): Promise<Work | undefined> => {
      if (!workCache.current) {
        workCache.current = {};
      }

      if (workCache.current[uuid]) {
        return workCache.current[uuid];
      }

      const work = await getTranslationMetadataByUuid({ client, uuid });
      if (!work) {
        return undefined;
      }

      workCache.current[uuid] = work;
      return work;
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
      const hash = state.hash ? `#${state.hash}` : window.location.hash;

      const newUrl = `?${params.toString()}${hash}`;
      window.history.replaceState(null, '', newUrl);
    },
    [],
  );

  const parsePanelParams = useCallback((): {
    toh?: TohokuCatalogEntry;
    panels: PanelsState;
  } => {
    const params = new URLSearchParams(window.location.search);
    const panels: PanelsState = { ...DEFAULT_PANELS };

    for (const [key, value] of params.entries()) {
      const match = value.match(/^(open|closed)(?::(.+))?$/);
      if (match) {
        const [, state, tab] = match;
        const panelKey = key as PanelName;
        if (!PANEL_NAMES.includes(panelKey)) {
          continue;
        }
        panels[panelKey] = {
          open: state === 'open',
          tab: tab as TabName | undefined,
        };
      }
    }

    const toh = (params.get('toh') as TohokuCatalogEntry) || undefined;

    return { toh, panels };
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
    if (!toh) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set('toh', toh);

    const newUrl = `?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [toh]);

  useEffect(() => {
    if (!uuid || !toh) {
      return;
    }

    (async () => {
      const imprint = await getTranslationImprint({ client, uuid, toh });
      setImprint(imprint);
    })();
  }, [uuid, toh, client]);

  useEffect(() => {
    const { panels: newPanels, toh: newToh } = parsePanelParams();

    if (newPanels) {
      setPanels(newPanels);
    }

    if (newToh) {
      setToh(newToh);
    }

    scrollToHash({
      delay: 100,
    });
  }, [query, parsePanelParams]);

  return (
    <NavigationContext.Provider
      value={{
        uuid,
        imprint,
        panels,
        toh,
        setToh,
        updatePanel,
        createHashLink,
        fetchBibliographyEntry,
        fetchEndNote,
        fetchGlossaryTerm,
        fetchPassage,
        fetchWork,
      }}
    >
      <HoverCardProvider
        fetchEndNote={fetchEndNote}
        fetchGlossaryInstance={fetchGlossaryTerm}
      >
        {children}
      </HoverCardProvider>
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
