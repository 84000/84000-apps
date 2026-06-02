'use client';

import { useInView } from 'motion/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigation } from './NavigationProvider';
import {
  createGraphQLClient,
  getWorkFolios,
  getWorkFoliosAround,
} from '@eightyfourthousand/client-graphql';
import type { Folio } from '@eightyfourthousand/data-access';
import { LabeledElement } from './LabeledElement';
import { PassageSkeleton } from './PassageSkeleton';
import {
  isUuid,
  scrollToElement,
  useIsMobile,
} from '@eightyfourthousand/lib-utils';
import {
  LotusPond,
  SHEET_ANIMATION_DURATION,
} from '@eightyfourthousand/design-system';
import { findScrollParent } from './hooks/useScrollPositionRestore';

const PAGE_SIZE = 10;

export const SourceReader = () => {
  // Window of loaded folios plus its absolute position within the work's
  // ordered folio list. `loadedStart` is the absolute index of `folios[0]`,
  // so the window covers [loadedStart, loadedStart + folios.length).
  const [folios, setFolios] = useState<Folio[]>([]);
  const [loadedStart, setLoadedStart] = useState(0);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [hasMoreAfter, setHasMoreAfter] = useState(true);
  const [loadingBefore, setLoadingBefore] = useState(false);
  const [loadingAfter, setLoadingAfter] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { toh, uuid, panels, updatePanel } = useNavigation();
  const isMobile = useIsMobile();
  const client = useMemo(() => createGraphQLClient(), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreBeforeRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const inViewAfter = useInView(loadMoreRef);
  const inViewBefore = useInView(loadMoreBeforeRef);

  // Guards a deep-link navigation so sentinel-driven loads don't prepend/append
  // (shifting the target) while we're scrolling to it.
  const navigatingRef = useRef(false);
  const processedHashRef = useRef<string | undefined>(undefined);
  // When prepending, the scroll position must be anchored so the viewport
  // doesn't jump. We capture the pre-prepend metrics here and restore in a
  // layout effect once the new folios have rendered.
  const pendingAnchorRef = useRef<{ prevHeight: number; prevTop: number } | null>(
    null,
  );

  // Only react to a source-tab hash (the deep-link target folio uuid).
  const panelHash =
    panels.main?.tab === 'source' ? panels.main?.hash : undefined;

  const getScrollParent = useCallback(() => {
    if (!scrollParentRef.current && containerRef.current) {
      scrollParentRef.current = findScrollParent(containerRef.current);
    }
    return scrollParentRef.current;
  }, []);

  // Reset when the work changes; the initialization effect will repopulate.
  useEffect(() => {
    setFolios([]);
    setLoadedStart(0);
    setHasMoreBefore(false);
    setHasMoreAfter(true);
    setLoadingBefore(false);
    setLoadingAfter(false);
    setInitialized(false);
    processedHashRef.current = undefined;
    scrollParentRef.current = null;
  }, [toh, uuid]);

  // Initial load. When there's no deep-link hash, load from the top (folio 0).
  // When a hash is present, the navigation effect seeds the window around the
  // target instead, so we skip the top load here.
  useEffect(() => {
    if (initialized || !toh || !uuid || panelHash) {
      return;
    }
    let cancelled = false;
    (async () => {
      const first = await getWorkFolios({
        client,
        uuid,
        toh,
        offset: 0,
        size: PAGE_SIZE,
      });
      if (cancelled) {
        return;
      }
      setFolios(first);
      setLoadedStart(0);
      setHasMoreBefore(false);
      setHasMoreAfter(first.length >= PAGE_SIZE);
      setInitialized(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialized, toh, uuid, panelHash, client]);

  const loadAfter = useCallback(async () => {
    if (
      !initialized ||
      !toh ||
      !uuid ||
      loadingAfter ||
      !hasMoreAfter ||
      navigatingRef.current
    ) {
      return;
    }
    setLoadingAfter(true);
    const offset = loadedStart + folios.length;
    const next = await getWorkFolios({
      client,
      uuid,
      toh,
      offset,
      size: PAGE_SIZE,
    });
    setFolios((prev) => [...prev, ...next]);
    setHasMoreAfter(next.length >= PAGE_SIZE);
    setLoadingAfter(false);
  }, [
    initialized,
    toh,
    uuid,
    loadingAfter,
    hasMoreAfter,
    loadedStart,
    folios.length,
    client,
  ]);

  const loadBefore = useCallback(async () => {
    if (
      !initialized ||
      !toh ||
      !uuid ||
      loadingBefore ||
      !hasMoreBefore ||
      loadedStart <= 0 ||
      navigatingRef.current
    ) {
      return;
    }
    setLoadingBefore(true);
    const newStart = Math.max(0, loadedStart - PAGE_SIZE);
    const size = loadedStart - newStart;
    const before = await getWorkFolios({
      client,
      uuid,
      toh,
      offset: newStart,
      size,
    });

    // Capture scroll metrics immediately before the prepend so the layout
    // effect can keep the viewport anchored.
    const scrollEl = getScrollParent();
    pendingAnchorRef.current = scrollEl
      ? { prevHeight: scrollEl.scrollHeight, prevTop: scrollEl.scrollTop }
      : null;

    setFolios((prev) => [...before, ...prev]);
    setLoadedStart(newStart);
    setHasMoreBefore(newStart > 0);
    setLoadingBefore(false);
  }, [
    initialized,
    toh,
    uuid,
    loadingBefore,
    hasMoreBefore,
    loadedStart,
    client,
    getScrollParent,
  ]);

  // Restore scroll position after a prepend so the viewport stays put.
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    const scrollEl = scrollParentRef.current;
    if (anchor && scrollEl) {
      scrollEl.scrollTop =
        anchor.prevTop + (scrollEl.scrollHeight - anchor.prevHeight);
      pendingAnchorRef.current = null;
    }
  }, [folios]);

  useEffect(() => {
    if (inViewAfter) {
      loadAfter();
    }
  }, [inViewAfter, loadAfter]);

  useEffect(() => {
    if (inViewBefore) {
      loadBefore();
    }
  }, [inViewBefore, loadBefore]);

  // Deep-link navigation: scroll to a target folio, loading a window around it
  // first if it isn't already in the DOM.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !panelHash || !toh || !uuid) {
      return;
    }
    if (processedHashRef.current === panelHash) {
      return;
    }
    processedHashRef.current = panelHash;

    const clearHash = () => {
      updatePanel({
        name: 'main',
        state: { ...panels.main, hash: undefined },
      });
    };

    (async () => {
      navigatingRef.current = true;
      try {
        // On mobile, wait for the panel Sheet animation before scrolling.
        if (isMobile) {
          await new Promise((resolve) =>
            setTimeout(resolve, SHEET_ANIMATION_DURATION),
          );
        }

        let element = container.querySelector<HTMLElement>(
          `#${CSS.escape(panelHash)}`,
        );

        if (!element && isUuid(panelHash)) {
          const around = await getWorkFoliosAround({
            client,
            uuid,
            toh,
            folioUuid: panelHash,
          });
          if (!around) {
            clearHash();
            return;
          }

          setFolios(around.folios);
          setLoadedStart(around.startIndex);
          setHasMoreBefore(around.hasMoreBefore);
          setHasMoreAfter(around.hasMoreAfter);
          setInitialized(true);

          // Wait for the window to render and the target's position to settle.
          await new Promise<void>((resolve) => {
            let stabilityCount = 0;
            let lastTop = -1;

            const checkStability = () => {
              const el = container.querySelector<HTMLElement>(
                `#${CSS.escape(panelHash)}`,
              );
              if (!el) {
                requestAnimationFrame(checkStability);
                return;
              }

              const currentTop = el.getBoundingClientRect().top;
              if (currentTop === lastTop) {
                stabilityCount++;
                if (stabilityCount >= 2) {
                  resolve();
                  return;
                }
              } else {
                stabilityCount = 0;
              }

              lastTop = currentTop;
              requestAnimationFrame(checkStability);
            };

            requestAnimationFrame(checkStability);
          });

          element = container.querySelector<HTMLElement>(
            `#${CSS.escape(panelHash)}`,
          );
        }

        if (!element) {
          clearHash();
          return;
        }

        await scrollToElement({ element });
        clearHash();
      } catch (error) {
        console.error('Folio navigation failed:', error);
      } finally {
        navigatingRef.current = false;
      }
    })();
    // `panels` is intentionally excluded: we only read its current value when
    // clearing the hash. Including it would loop, since updatePanel() creates a
    // new panels object on every call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelHash, toh, uuid, isMobile, client, updatePanel]);

  return (
    <div
      ref={containerRef}
      className="pt-12 flex flex-col gap-5 mx-auto max-w-readable 2xl:max-w-380"
    >
      <div ref={loadMoreBeforeRef} className="h-0" />
      {hasMoreBefore && (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <PassageSkeleton key={`before-${i}`} />
          ))}
        </>
      )}
      {folios.map((folio) => (
        <LabeledElement
          key={folio.uuid}
          id={folio.uuid}
          label={`f.${folio.folio}.${folio.side}\nvol.${folio.volume}`}
          className="mt-0.5"
          contentType="source"
          excerpt={folio.content.slice(0, 100)}
        >
          {folio.content ? (
            <div className="leading-7 min-h-8 font-tibetan text-lg 2xl:whitespace-pre-wrap whitespace-normal">
              {folio.content}
            </div>
          ) : (
            <div className="h-12 text-center text-muted-foreground">
              [blank]
            </div>
          )}
        </LabeledElement>
      ))}
      <div ref={loadMoreRef} className="h-0" />
      {hasMoreAfter ? (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <PassageSkeleton key={`after-${i}`} />
          ))}
        </>
      ) : (
        <div className="w-full pt-16 pb-6">
          <LotusPond className="mx-auto w-96" />
        </div>
      )}
    </div>
  );
};
