'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import {
  createGraphQLClient,
  getWorkGlossaryTerms,
  getWorkGlossaryTermsAround,
} from '@eightyfourthousand/client-graphql';
import { isUuid, scrollToElement } from '@eightyfourthousand/lib-utils';
import { useNavigation } from '../NavigationProvider';
import { GlossarySkeleton } from './GlossarySkeleton';
import { usePaginationLoadTriggers } from '../hooks/usePaginationLoadTriggers';

const LOADING_SKELETONS_COUNT = 3;

interface GlossaryPaginationState {
  terms: GlossaryTermInstance[];
  startCursor?: string;
  endCursor?: string;
  totalCount: number;
  startIsLoading: boolean;
  endIsLoading: boolean;
}

const GlossaryPaginationContext = createContext<GlossaryPaginationState>({
  terms: [],
  totalCount: 0,
  startIsLoading: false,
  endIsLoading: false,
});

export const GlossaryPaginationProvider = ({
  workUuid,
  initialPage,
  withAttestations = false,
  children,
}: {
  workUuid: string;
  initialPage: GlossaryTermsPage;
  withAttestations?: boolean;
  children: ReactNode;
}) => {
  const [terms, setTerms] = useState(initialPage.terms);
  const [startCursor, setStartCursor] = useState<string | undefined>(
    initialPage.prevCursor,
  );
  const [endCursor, setEndCursor] = useState<string | undefined>(
    initialPage.nextCursor,
  );
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);

  const [startIsLoading, setStartIsLoading] = useState(false);
  const [endIsLoading, setEndIsLoading] = useState(false);
  const [navCursor, setNavCursor] = useState<string | undefined>();
  const processedNavCursorRef = useRef<string | undefined>(undefined);
  const isNavigatingRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const handledStartLoadRequestRef = useRef(0);
  const handledEndLoadRequestRef = useRef(0);

  // Stable reference — prevents re-renders from re-triggering load effects
  const dataClient = useMemo(() => createGraphQLClient(), []);
  const { panels, updatePanel } = useNavigation();
  const {
    loadMoreAtStartRef: observedLoadMoreAtStartRef,
    loadMoreAtEndRef,
    startLoadRequest,
    endLoadRequest,
  } = usePaginationLoadTriggers({
    startCursor,
    endCursor,
    startIsLoading,
    endIsLoading,
  });

  // Only accept hash when right panel is on glossary tab
  const panelHash =
    panels.right?.tab === 'glossary' ? panels.right?.hash : undefined;

  // Track hash changes
  useEffect(() => {
    setNavCursor(panelHash);
  }, [panelHash]);

  useEffect(() => {
    if (!panelHash) {
      processedNavCursorRef.current = undefined;
    }
  }, [panelHash]);

  // Hash navigation: navigate to a specific glossary term
  useEffect(() => {
    if (!navCursor || startIsLoading || endIsLoading) return;
    if (processedNavCursorRef.current === navCursor) return;
    processedNavCursorRef.current = navCursor;

    (async () => {
      isNavigatingRef.current = true;
      try {
        const container = contentRef.current;
        if (!container) return;

        // Check if element is already in the DOM
        let element = container.querySelector<HTMLElement>(
          `#${CSS.escape(navCursor)}`,
        );

        if (!element && isUuid(navCursor)) {
          // Show loading skeleton while fetching
          setTerms([]);
          setStartCursor(undefined);
          setEndCursor(undefined);
          setEndIsLoading(true);

          // Fetch a page around this term
          const page = await getWorkGlossaryTermsAround({
            client: dataClient,
            uuid: workUuid,
            termUuid: navCursor,
            withAttestations,
          });

          if (page.terms.length === 0) return;

          setTerms(page.terms);
          setStartCursor(page.prevCursor);
          setEndCursor(page.nextCursor);
          setTotalCount(page.totalCount);

          // Wait for DOM update
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          });

          element = container.querySelector<HTMLElement>(
            `#${CSS.escape(navCursor)}`,
          );
        }

        if (element) {
          await scrollToElement({ element, behavior: 'smooth' });
          updatePanel({
            name: 'right',
            state: { ...panels.right, hash: undefined },
          });
        }
      } finally {
        isNavigatingRef.current = false;
        setEndIsLoading(false);
      }
    })();
  }, [navCursor, startIsLoading, endIsLoading, workUuid]);

  // Load more at end (forward pagination)
  useEffect(() => {
    if (
      endLoadRequest === 0 ||
      handledEndLoadRequestRef.current === endLoadRequest ||
      endIsLoading ||
      !endCursor ||
      isNavigatingRef.current
    ) {
      return;
    }

    handledEndLoadRequestRef.current = endLoadRequest;
    setEndIsLoading(true);

    (async () => {
      const page = await getWorkGlossaryTerms({
        client: dataClient,
        uuid: workUuid,
        cursor: endCursor,
        direction: 'forward',
        withAttestations,
      });

      if (page.terms.length > 0) {
        setTerms((prev) => [...prev, ...page.terms]);
      }

      setEndCursor(
        page.hasMoreAfter && page.nextCursor ? page.nextCursor : undefined,
      );
      setEndIsLoading(false);
    })();
  }, [workUuid, endIsLoading, endCursor, endLoadRequest]);

  // Load more at start (backward pagination)
  useEffect(() => {
    if (
      startLoadRequest === 0 ||
      handledStartLoadRequestRef.current === startLoadRequest ||
      startIsLoading ||
      !startCursor ||
      isNavigatingRef.current
    ) {
      return;
    }

    handledStartLoadRequestRef.current = startLoadRequest;
    setStartIsLoading(true);

    (async () => {
      const scrollContainer = contentRef.current?.closest(
        '[data-panel]',
      ) as HTMLElement | null;
      const previousScrollHeight = scrollContainer?.scrollHeight ?? 0;
      const previousScrollTop = scrollContainer?.scrollTop ?? 0;

      const page = await getWorkGlossaryTerms({
        client: dataClient,
        uuid: workUuid,
        cursor: startCursor,
        direction: 'backward',
      });

      if (page.terms.length > 0) {
        setTerms((prev) => [...page.terms, ...prev]);

        // Restore scroll position after prepending
        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const deltaHeight = newScrollHeight - previousScrollHeight;
            scrollContainer.scrollTop = previousScrollTop + deltaHeight;
          }
        });
      }

      setStartCursor(
        page.hasMoreBefore && page.prevCursor ? page.prevCursor : undefined,
      );
      setStartIsLoading(false);
    })();
  }, [workUuid, startIsLoading, startCursor, startLoadRequest]);

  return (
    <GlossaryPaginationContext.Provider
      value={{
        terms,
        startCursor,
        endCursor,
        totalCount,
        startIsLoading,
        endIsLoading,
      }}
    >
      <div ref={observedLoadMoreAtStartRef} className="h-0" />
      <div ref={contentRef}>{children}</div>
      <div ref={loadMoreAtEndRef} className="h-0" />
      {(endCursor || (endIsLoading && terms.length === 0)) && (
        <div className="flex flex-col gap-6 pb-4 pt-6">
          {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
            <GlossarySkeleton key={i} />
          ))}
        </div>
      )}
    </GlossaryPaginationContext.Provider>
  );
};

export const useGlossaryPagination = () => {
  return useContext(GlossaryPaginationContext);
};
