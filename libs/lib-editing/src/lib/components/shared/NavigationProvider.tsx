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
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
import {
  PANEL_NAMES,
  PanelName,
  PanelsState,
  PanelState,
  TabName,
} from './types';
import { HoverCardProvider } from './HoverCardProvider';
import { useFeatureFlagEnabled } from '@lib-instr';
import { useIsMobile } from '@lib-utils';
import { RestrictionWarning } from './RestrictionWarning';

interface NavigationState {
  uuid: string;
  imprint?: Imprint;
  panels: PanelsState;
  toh?: TohokuCatalogEntry;
  showOuterContent: boolean;
  setToh: (toh: TohokuCatalogEntry) => void;
  setShowOuterContent: (withTitles: boolean) => void;
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

const DEFAULT_PANELS: PanelsState = {
  left: { open: true, tab: 'toc' },
  right: { open: false, tab: 'endnotes' },
  main: { open: true, tab: 'translation' },
};

export const NavigationContext = createContext<NavigationState>({
  uuid: '',
  panels: DEFAULT_PANELS,
  showOuterContent: true,
  updatePanel: () => {
    throw new Error('Not implemented');
  },
  setToh: () => {
    throw new Error('Not implemented');
  },
  setShowOuterContent: () => {
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

const parsePanelParams = (
  params: ReadonlyURLSearchParams,
): {
  toh?: TohokuCatalogEntry;
  panels: PanelsState;
} => {
  const panels: PanelsState = { ...DEFAULT_PANELS };

  for (const [key, value] of params.entries()) {
    const match = value.match(/^(open|closed)(?::(.+))?$/);
    if (match) {
      const [state, tab, hash] = value.split(':');
      const panelKey = key as PanelName;
      if (!PANEL_NAMES.includes(panelKey)) {
        continue;
      }
      panels[panelKey] = {
        open: state === 'open',
        tab: tab as TabName | undefined,
        hash: hash || undefined,
      };
    }
  }

  const toh = (params.get('toh') as TohokuCatalogEntry) || undefined;

  return { toh, panels };
};

export const NavigationProvider = ({
  uuid,
  children,
}: {
  uuid: string;
  children: ReactNode;
}) => {
  const client = createBrowserClient();
  const query = useSearchParams();
  const isMobile = useIsMobile();
  const [panels, setPanels] = useState<PanelsState>(
    parsePanelParams(query).panels || DEFAULT_PANELS,
  );
  const [isPanelTransitioning, setIsPanelTransitioning] = useState(false);
  const [toh, setToh] = useState<TohokuCatalogEntry | undefined>();
  const [showOuterContent, setShowOuterContent] = useState(true);
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
      const { open } = state;
      setIsPanelTransitioning(true);
      setPanels((prev) => {
        const newPanels = {
          ...prev,
          [name]: state,
        };

        // On mobile, auto-close sidebars when navigating to other panels
        if (isMobile && open) {
          // If opening left panel with navigation, close right panel
          if (name === 'left') {
            newPanels.right = { ...prev.right, open: false };
          }
          // If opening right panel with navigation, close left panel
          else if (name === 'right') {
            newPanels.left = { ...prev.left, open: false };
          }
          // If opening main panel with navigation, close both sidebars
          else if (name === 'main') {
            newPanels.left = { ...prev.left, open: false };
            newPanels.right = { ...prev.right, open: false };
          }
        }

        return newPanels;
      });
    },
    [isMobile],
  );

  useEffect(() => {
    if (!toh && !panels) {
      return;
    }

    setIsPanelTransitioning(true);
    const params = new URLSearchParams(window.location.search);

    if (toh) {
      params.set('toh', toh);
    }

    if (panels) {
      Object.entries(panels).forEach(([panelName, panelState]) => {
        const { open, tab, hash } = panelState;
        const openness = open ? 'open' : 'closed';
        params.set(
          panelName,
          `${openness}${tab ? `:${tab}` : ''}${hash ? `:${hash}` : ''}`,
        );
      });
    }

    const newUrl = `?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [toh, panels]);

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
    if (isPanelTransitioning) {
      setIsPanelTransitioning(false);
      return;
    }

    const { panels: newPanels, toh: newToh } = parsePanelParams(query);

    if (newPanels) {
      setPanels(newPanels);
    }

    if (newToh) {
      setToh(newToh);
    }
  }, [query, parsePanelParams]);

  const hasHoverCards = useFeatureFlagEnabled('translation-hover-cards');

  return (
    <NavigationContext.Provider
      value={{
        uuid,
        imprint,
        panels,
        toh,
        showOuterContent,
        setToh,
        setShowOuterContent,
        updatePanel,
        fetchBibliographyEntry,
        fetchEndNote,
        fetchGlossaryTerm,
        fetchPassage,
        fetchWork,
      }}
    >
      {hasHoverCards ? (
        <HoverCardProvider
          fetchEndNote={fetchEndNote}
          fetchGlossaryInstance={fetchGlossaryTerm}
        >
          {children}
        </HoverCardProvider>
      ) : (
        children
      )}
      <RestrictionWarning imprint={imprint} />
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
