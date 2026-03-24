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
import type { GlossaryTermInstance } from '@84000/data-access';
import type { GlossaryTermsPage } from '@84000/client-graphql';
import {
  createGraphQLClient,
  getWorkGlossaryTerms,
  getWorkGlossaryTermsAround,
} from '@84000/client-graphql';
import { isUuid, scrollToElement } from '@84000/lib-utils';
import { useNavigation } from '../NavigationProvider';
import { GlossarySkeleton } from './GlossarySkeleton';

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
  children,
}: {
  workUuid: string;
  initialPage: GlossaryTermsPage;
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

  const loadMoreAtStartRef = useRef<HTMLDivElement>(null);
  const loadMoreAtEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startCursorRef = useRef(startCursor);
  const endCursorRef = useRef(endCursor);
  const startLoadArmedRef = useRef(true);
  const endLoadArmedRef = useRef(true);
  const handledStartLoadRequestRef = useRef(0);
  const handledEndLoadRequestRef = useRef(0);
  const [startLoadRequest, setStartLoadRequest] = useState(0);
  const [endLoadRequest, setEndLoadRequest] = useState(0);

  // Stable reference — prevents re-renders from re-triggering load effects
  const dataClient = useMemo(() => createGraphQLClient(), []);
  const { panels, updatePanel } = useNavigation();

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

  useEffect(() => {
    startCursorRef.current = startCursor;
  }, [startCursor]);

  useEffect(() => {
    endCursorRef.current = endCursor;
  }, [endCursor]);

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

  // IntersectionObserver for load-more sentinels
  useEffect(() => {
    const startEl = loadMoreAtStartRef.current;
    const endEl = loadMoreAtEndRef.current;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === startEl && !entry.isIntersecting) {
          startLoadArmedRef.current = true;
          continue;
        }

        if (entry.target === endEl && !entry.isIntersecting) {
          endLoadArmedRef.current = true;
          continue;
        }

        if (entry.target === startEl && startCursorRef.current) {
          if (!startLoadArmedRef.current) {
            continue;
          }
          startLoadArmedRef.current = false;
          setStartLoadRequest((c) => c + 1);
        } else if (entry.target === endEl && endCursorRef.current) {
          if (!endLoadArmedRef.current) {
            continue;
          }
          endLoadArmedRef.current = false;
          setEndLoadRequest((c) => c + 1);
        }
      }
    });

    if (startEl) observer.observe(startEl);
    if (endEl) observer.observe(endEl);

    return () => observer.disconnect();
  }, []);

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
      <div ref={loadMoreAtStartRef} className="h-0" />
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
