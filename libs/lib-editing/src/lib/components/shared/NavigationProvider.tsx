'use client';

import {
  createGraphQLClient,
  getBibliographyEntry,
  getGlossaryInstance,
  getPassage,
  getTranslationImprint,
  getTranslationMetadataByUuid,
} from '@eightyfourthousand/client-graphql';
import type {
  BibliographyEntryItem,
  GlossaryTermInstance,
  Imprint,
  Passage,
  TohokuCatalogEntry,
  Work,
} from '@eightyfourthousand/data-access';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';
import {
  PANEL_NAMES,
  PANEL_FOR_SECTION,
  PanelName,
  PanelsState,
  PanelState,
  TAB_FOR_SECTION,
  TabName,
} from './types';
import { HoverCardProvider } from './HoverCardProvider';
import { GatedFeature, useFeatureFlagEnabled } from '@eightyfourthousand/lib-instr';
import { isXmlId, useIsMobile } from '@eightyfourthousand/lib-utils';
import { RestrictionWarning } from './RestrictionWarning';
import { NavigationContext, DEFAULT_PANELS } from './NavigationContext';

export { NavigationContext, useNavigation } from './NavigationContext';
export type { NavigationState } from './NavigationContext';

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
  initialHasTranslationContent = true,
  children,
}: {
  uuid: string;
  initialHasTranslationContent?: boolean;
  children: ReactNode;
}) => {
  const graphqlClient = createGraphQLClient();
  const query = useSearchParams();
  const isMobile = useIsMobile();
  const [panels, setPanels] = useState<PanelsState>(
    parsePanelParams(query).panels || DEFAULT_PANELS,
  );
  const isPanelTransitioning = useRef(false);
  const [toh, setToh] = useState<TohokuCatalogEntry | undefined>();
  const [showOuterContent, setShowOuterContent] = useState(true);
  const [hasTranslationContent, setHasTranslationContent] = useState(
    initialHasTranslationContent,
  );
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

      const entry = await getBibliographyEntry({
        client: graphqlClient,
        uuid,
      });
      if (!entry) {
        return undefined;
      }

      bibliographyCache.current[uuid] = entry;
      return entry;
    },
    [graphqlClient],
  );

  const fetchEndNote = useCallback(
    async (uuid: string): Promise<Passage | undefined> => {
      if (!endnoteCache.current) {
        endnoteCache.current = {};
      }

      if (endnoteCache.current[uuid]) {
        return endnoteCache.current[uuid];
      }

      const endnote = await getPassage({ client: graphqlClient, uuid });
      if (!endnote) {
        return undefined;
      }

      endnoteCache.current[uuid] = endnote;
      return endnote;
    },
    [graphqlClient],
  );

  const fetchGlossaryTerm = useCallback(
    async (uuid: string) => {
      if (!glossaryCache.current) {
        glossaryCache.current = {};
      }

      if (glossaryCache.current[uuid]) {
        return glossaryCache.current[uuid];
      }

      const term = await getGlossaryInstance({ client: graphqlClient, uuid });
      if (!term) {
        return undefined;
      }

      glossaryCache.current[uuid] = term;
      return term;
    },
    [graphqlClient],
  );

  const fetchPassage = useCallback(
    async (uuid: string): Promise<Passage | undefined> => {
      if (!passageCache.current) {
        passageCache.current = {};
      }

      if (passageCache.current[uuid]) {
        return passageCache.current[uuid];
      }

      const passage = await getPassage({ client: graphqlClient, uuid });
      if (!passage) {
        return undefined;
      }

      passageCache.current[uuid] = passage;
      return passage;
    },
    [graphqlClient],
  );

  const fetchWork = useCallback(
    async (uuid: string): Promise<Work | undefined> => {
      if (!workCache.current) {
        workCache.current = {};
      }

      if (workCache.current[uuid]) {
        return workCache.current[uuid];
      }

      const work = await getTranslationMetadataByUuid({
        client: graphqlClient,
        uuid,
      });
      if (!work) {
        return undefined;
      }

      workCache.current[uuid] = work;
      return work;
    },
    [graphqlClient],
  );

  const updatePanel = useCallback(
    ({ name, state }: { name: PanelName; state: PanelState }) => {
      const { open } = state;
      isPanelTransitioning.current = true;
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
    [isMobile, hasTranslationContent],
  );

  useEffect(() => {
    if (!toh && !panels) {
      return;
    }

    isPanelTransitioning.current = true;
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

  // On initial load, check for an XML ID in the URL hash and resolve it to a passage UUID
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !isXmlId(hash)) {
      return;
    }

    // Remove hash from URL immediately
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    );

    (async () => {
      const passage = await getPassage({ client: graphqlClient, xmlId: hash });
      if (!passage) {
        return;
      }

      const panel = PANEL_FOR_SECTION[passage.type] ?? 'main';
      const tab = TAB_FOR_SECTION[passage.type] ?? 'translation';

      updatePanel({
        name: panel,
        state: { open: true, tab, hash: passage.uuid },
      });
    })();
  }, []);

  useEffect(() => {
    if (!uuid || !toh) {
      return;
    }

    (async () => {
      const imprint = await getTranslationImprint({
        client: graphqlClient,
        uuid,
        toh,
      });
      setImprint(imprint);
    })();
  }, [uuid, toh, graphqlClient]);

  useEffect(() => {
    if (isPanelTransitioning.current) {
      isPanelTransitioning.current = false;
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

  useEffect(() => {
    if (!hasTranslationContent) {
      setPanels((prev) => {
        if (!prev.right.open) {
          return prev;
        }
        return {
          ...prev,
          right: { ...prev.right, open: false },
        };
      });
    }
  }, [hasTranslationContent]);

  const contextValue = useMemo(
    () => ({
      uuid,
      imprint,
      panels,
      toh,
      showOuterContent,
      hasTranslationContent,
      setToh,
      setShowOuterContent,
      setHasTranslationContent,
      updatePanel,
      fetchBibliographyEntry,
      fetchEndNote,
      fetchGlossaryTerm,
      fetchPassage,
      fetchWork,
    }),
    [
      uuid,
      imprint,
      panels,
      toh,
      showOuterContent,
      hasTranslationContent,
      setToh,
      setShowOuterContent,
      setHasTranslationContent,
      updatePanel,
      fetchBibliographyEntry,
      fetchEndNote,
      fetchGlossaryTerm,
      fetchPassage,
      fetchWork,
    ],
  );

  return (
    <NavigationContext.Provider value={contextValue}>
      <HoverCardProvider enabled={hasHoverCards}>{children}</HoverCardProvider>
      <GatedFeature flag="show-restriction-warning">
        <RestrictionWarning imprint={imprint} />
      </GatedFeature>
    </NavigationContext.Provider>
  );
};

