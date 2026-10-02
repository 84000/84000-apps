'use client';

import {
  createGraphQLClient,
  lookup,
  getPassage,
  getTranslationImprint,
} from '@eightyfourthousand/client-graphql';
import type {
  Imprint,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  HighlightRange,
  locationForPassageType,
  PanelName,
  PanelsState,
  PanelState,
  TabName,
} from './types';
import { HoverCardProvider } from './HoverCardProvider';
import { useFeatureFlagEnabled } from '@eightyfourthousand/lib-instr';
import { isStaticFeatureEnabled } from '@eightyfourthousand/lib-instr/static';
import { isXmlId, useIsMobile } from '@eightyfourthousand/lib-utils';
import { RestrictionWarning } from './RestrictionWarning';
import {
  NavigationContext,
  DEFAULT_PANELS,
  type EditorRequestHandler,
} from './NavigationContext';
import { parseHighlight, parsePanelParams } from './navigation-params';
import { useNavigationFetchers } from './hooks/useNavigationFetchers';

export { NavigationContext, useNavigation } from './NavigationContext';
export type { NavigationState } from './NavigationContext';

export const NavigationProvider = ({
  uuid,
  initialToh,
  initialHasTranslationContent = true,
  editable = false,
  children,
}: {
  /** The studio rather than the reader. Defaults to the reader. */
  editable?: boolean;
  uuid: string;
  initialToh?: TohokuCatalogEntry;
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
  const [toh, setToh] = useState<TohokuCatalogEntry | undefined>(
    parsePanelParams(query).toh || initialToh,
  );
  const [showOuterContent, setShowOuterContent] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [highlight, setHighlight] = useState<HighlightRange | undefined>(() =>
    parseHighlight(query),
  );
  const [focusedComment, setFocusedComment] = useState<string | undefined>();
  const [commentsRevision, setCommentsRevision] = useState(0);
  const [hasTranslationContent, setHasTranslationContent] = useState(
    initialHasTranslationContent,
  );
  const [imprint, setImprint] = useState<Imprint | undefined>();
  const {
    fetchBibliographyEntry,
    fetchEndNote,
    fetchGlossaryTerm,
    fetchPassage,
    fetchWork,
  } = useNavigationFetchers(graphqlClient);

  // Registered by hosts whose editors come and go — the passage stack mounts
  // one per passage, so an anchor on a static row has none until something
  // asks for it. Every stack registers, and each answers only for its rows.
  const editorRequests = useRef(new Set<EditorRequestHandler>());
  const registerEditorRequest = useCallback((request: EditorRequestHandler) => {
    editorRequests.current.add(request);
    return () => {
      editorRequests.current.delete(request);
    };
  }, []);
  const requestEditorFor = useCallback(async (element: HTMLElement) => {
    for (const request of editorRequests.current) {
      const pending = request(element);
      if (pending) return pending;
    }
    return null;
  }, []);

  const refreshComments = useCallback(
    () => setCommentsRevision((revision) => revision + 1),
    [],
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

  /**
   * Clicking a comment anchor focuses its thread and opens the panel on it.
   *
   * Delegated from the document rather than bound in the mark view: most of a
   * work is static HTML with no mark view to bind to, so a listener there would
   * make only the passages under a mounted editor clickable. `closest` picks
   * the innermost anchor, which is the most specific thread where comment marks
   * overlap.
   *
   * The panel opens through `updatePanel` rather than a history write, which
   * the URL sync below would overwrite unread.
   */
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[type="comment"]',
      );
      const comment = anchor?.getAttribute('comment');
      if (!comment) return;

      setFocusedComment(comment);

      // The comments tab is the studio's. A reader has no panel to open.
      if (editable) {
        updatePanel({
          name: 'left',
          state: { open: true, tab: 'comments', hash: comment },
        });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [editable, updatePanel]);

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

  // On initial load, check for an XML ID in the URL hash and resolve it to an entity UUID.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !isXmlId(hash)) {
      return;
    }

    (async () => {
      const result = await lookup({ client: graphqlClient, xmlId: hash });
      if (!result || result.type === 'work') {
        return;
      }

      let panel: PanelName | undefined;
      let tab: TabName | undefined;
      let uuid = result.uuid;

      if (result.type === 'passage') {
        const passage = await getPassage({
          client: graphqlClient,
          uuid: result.uuid,
        });
        if (!passage) {
          return;
        }

        ({ panel, tab } = locationForPassageType(passage.type));
        uuid = passage.uuid;
      } else if (result.type === 'glossary') {
        panel = 'right';
        tab = 'glossary';
      } else if (result.type === 'bibliography') {
        panel = 'right';
        tab = 'bibliography';
      }

      if (!panel || !tab) {
        return;
      }

      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      );

      updatePanel({
        name: panel,
        state: { open: true, tab, hash: uuid },
      });
    })();
  }, [graphqlClient, updatePanel]);

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

    // Router state is the external system here, and `isPanelTransitioning`
    // above guards against the feedback loop where our own panel writes push a
    // new query which then reads back. Both the guard and the ordering depend
    // on this staying an effect.
    if (newPanels) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from router state behind a transition guard
      setPanels(newPanels);
    }

    if (newToh) {
      setToh(newToh);
    }

    // Re-read the highlight range so an in-session navigation (e.g. a
    // same-work mention link that pushes `start`/`end`) triggers a highlight,
    // and navigating away (no range) clears it.
    setHighlight(parseHighlight(query));
  }, [query, parsePanelParams]);

  const hasHoverCards = useFeatureFlagEnabled('translation-hover-cards');
  // Static, not a PostHog flag: an ad blocker stops the flags arriving and the
  // reader loses a warning we are obliged to show.
  const showRestrictionWarning = isStaticFeatureEnabled(
    'show-restriction-warning',
  );

  // Close the right panel when there is no translation to show. `prev` starts
  // true so a first render that already lacks translation content still closes
  // it, matching the effect this replaced.
  const [prevHasTranslationContent, setPrevHasTranslationContent] =
    useState(true);
  if (hasTranslationContent !== prevHasTranslationContent) {
    setPrevHasTranslationContent(hasTranslationContent);
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
  }

  // Closing the panel that shows comment threads leaves no thread focused. The
  // anchor in the text is lit from `focusedComment`, so without this it stays
  // lit with nothing on screen to say why. Adjusted during render rather than
  // in an effect, like the close above.
  const [prevCommentsPanelOpen, setPrevCommentsPanelOpen] = useState(
    panels.left.open,
  );
  if (panels.left.open !== prevCommentsPanelOpen) {
    setPrevCommentsPanelOpen(panels.left.open);
    if (!panels.left.open && focusedComment) {
      setFocusedComment(undefined);
    }
  }

  const contextValue = useMemo(
    () => ({
      uuid,
      editable,
      imprint,
      panels,
      toh,
      showOuterContent,
      hasTranslationContent,
      focusMode,
      highlight,
      focusedComment,
      commentsRevision,
      setToh,
      setShowOuterContent,
      setHasTranslationContent,
      setFocusMode,
      setFocusedComment,
      refreshComments,
      updatePanel,
      fetchBibliographyEntry,
      fetchEndNote,
      fetchGlossaryTerm,
      fetchPassage,
      fetchWork,
      requestEditorFor,
      registerEditorRequest,
    }),
    [
      uuid,
      editable,
      imprint,
      panels,
      toh,
      showOuterContent,
      hasTranslationContent,
      focusMode,
      highlight,
      focusedComment,
      commentsRevision,
      setToh,
      setShowOuterContent,
      setHasTranslationContent,
      setFocusMode,
      setFocusedComment,
      refreshComments,
      updatePanel,
      fetchBibliographyEntry,
      fetchEndNote,
      fetchGlossaryTerm,
      fetchPassage,
      fetchWork,
      requestEditorFor,
      registerEditorRequest,
    ],
  );

  return (
    <NavigationContext.Provider value={contextValue}>
      <HoverCardProvider enabled={hasHoverCards}>{children}</HoverCardProvider>
      {showRestrictionWarning && <RestrictionWarning imprint={imprint} />}
    </NavigationContext.Provider>
  );
};
