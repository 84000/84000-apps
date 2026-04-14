'use client';

import type { PassageOccurrence } from '@eightyfourthousand/data-access';
import { getPassageOccurrences } from '@eightyfourthousand/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  Tabs,
  TabsContent,
} from '@eightyfourthousand/design-system';
import { Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { search } from '../data';
import type { PassageMatch, SearchResult, SearchResults } from '../types';
import { RESULTS_ENTITIES } from '../types';
import { SearchResultsList } from './SearchResultsList';
import { SearchResultTabs } from './SearchResultTab';

export type SearchPendingSelection =
  | { kind: 'index'; index: number }
  | { kind: 'cursor'; start: number; passageUuid: string };

export interface SearchActionContext {
  activeOccurrence?: PassageOccurrence;
  activeOccurrenceIndex: number;
  activePassageLabel?: string;
  activePassageUuid?: string;
  moveActiveOccurrence: (direction: 'next' | 'previous') => void;
  passageOccurrences: PassageOccurrence[];
  passages: PassageMatch[];
  refreshSearch: (options?: {
    nextSelection?: SearchPendingSelection | null;
  }) => Promise<void>;
  searchQuery: string;
  searching: boolean;
  scrollActiveOccurrenceIntoView: () => void;
  setActiveOccurrenceIndex: (index: number) => void;
  setShouldScrollActiveOccurrence: (shouldScroll: boolean) => void;
}

export interface SearchButtonProps {
  onResultSelected: (result: SearchResult) => void;
  renderActions?: (context: SearchActionContext) => ReactNode;
  toh?: string;
  workUuid?: string;
}

export const SearchButton = ({
  renderActions,
  workUuid,
  toh,
  onResultSelected,
}: SearchButtonProps) => {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults>();
  const [activeOccurrenceIndex, setActiveOccurrenceIndexState] = useState(0);
  const [shouldScrollActiveOccurrence, setShouldScrollActiveOccurrence] =
    useState(false);
  const pendingOccurrenceSelectionRef =
    useRef<SearchPendingSelection | null>(null);

  const passageOccurrences = useMemo(
    () => getPassageOccurrences(results?.passages || [], searchQuery),
    [results?.passages, searchQuery],
  );
  const activeOccurrence = passageOccurrences[activeOccurrenceIndex];
  const activeOccurrenceStart = activeOccurrence?.start ?? null;
  const activePassageUuid = activeOccurrence?.passageUuid;
  const activePassageLabel = results?.passages.find(
    (passage) => passage.uuid === activePassageUuid,
  )?.label;
  const passageOrder = useMemo(
    () =>
      new Map(
        (results?.passages || []).map((passage, index) => [passage.uuid, index]),
      ),
    [results?.passages],
  );

  const scrollActiveOccurrenceIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-search-result-active="true"]')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    });
  }, []);

  const refreshSearch = useCallback(
    async (options: { nextSelection?: SearchPendingSelection | null } = {}) => {
      if (!searchQuery || !workUuid || !toh) {
        setResults(undefined);
        setHasResults(false);
        return;
      }

      setSearching(true);
      const nextResults = await search({ text: searchQuery, uuid: workUuid, toh });
      setHasResults(
        !!nextResults &&
        (nextResults.passages.length > 0 ||
          nextResults.alignments.length > 0 ||
          nextResults.bibliographies.length > 0 ||
          nextResults.glossaries.length > 0),
      );
      setResults(nextResults);

      if ('nextSelection' in options) {
        pendingOccurrenceSelectionRef.current = options.nextSelection ?? null;
      }

      setSearching(false);
    },
    [searchQuery, toh, workUuid],
  );

  const setActiveOccurrenceIndex = useCallback(
    (nextIndex: number) => {
      pendingOccurrenceSelectionRef.current = null;
      setActiveOccurrenceIndexState(
        Math.max(0, Math.min(nextIndex, Math.max(passageOccurrences.length - 1, 0))),
      );
    },
    [passageOccurrences.length],
  );

  const moveActiveOccurrence = useCallback(
    (direction: 'next' | 'previous') => {
      if (passageOccurrences.length === 0) {
        return;
      }

      pendingOccurrenceSelectionRef.current = null;
      setActiveOccurrenceIndexState((current) => {
        if (direction === 'previous') {
          return Math.max(current - 1, 0);
        }

        return Math.min(current + 1, passageOccurrences.length - 1);
      });
    },
    [passageOccurrences.length],
  );

  useEffect(() => {
    const debounce = setTimeout(() => {
      void refreshSearch();
    }, 300);

    return () => clearTimeout(debounce);
  }, [refreshSearch]);

  useEffect(() => {
    setResults(undefined);
    setSearchQuery('');
    setActiveOccurrenceIndexState(0);
    setShouldScrollActiveOccurrence(false);
    pendingOccurrenceSelectionRef.current = null;
  }, [open]);

  useEffect(() => {
    if (passageOccurrences.length === 0) {
      setActiveOccurrenceIndexState(0);
      pendingOccurrenceSelectionRef.current = null;
      return;
    }

    const pendingSelection = pendingOccurrenceSelectionRef.current;
    if (pendingSelection) {
      if (pendingSelection.kind === 'index') {
        setActiveOccurrenceIndexState(
          Math.min(pendingSelection.index, passageOccurrences.length - 1),
        );
        pendingOccurrenceSelectionRef.current = null;
        return;
      }

      const nextIndex = passageOccurrences.findIndex((occurrence) => {
        if (
          pendingSelection.kind === 'cursor' &&
          occurrence.passageUuid === pendingSelection.passageUuid &&
          occurrence.start >= pendingSelection.start
        ) {
          return true;
        }

        return false;
      });

      if (nextIndex >= 0) {
        setActiveOccurrenceIndexState(nextIndex);
        pendingOccurrenceSelectionRef.current = null;
        return;
      }

      const currentPassageOrder =
        pendingSelection.kind === 'cursor'
          ? passageOrder.get(pendingSelection.passageUuid)
          : undefined;
      const nextPassageIndex =
        pendingSelection.kind === 'cursor' && currentPassageOrder != null
          ? passageOccurrences.findIndex((occurrence) => {
            const occurrenceOrder = passageOrder.get(occurrence.passageUuid);
            return (
              occurrenceOrder != null && occurrenceOrder > currentPassageOrder
            );
          })
          : -1;

      setActiveOccurrenceIndexState(nextPassageIndex >= 0 ? nextPassageIndex : 0);
      pendingOccurrenceSelectionRef.current = null;
      return;
    }

    setActiveOccurrenceIndexState((current) =>
      Math.min(current, passageOccurrences.length - 1),
    );
  }, [passageOccurrences, passageOrder]);

  useEffect(() => {
    if (
      !shouldScrollActiveOccurrence ||
      !activePassageUuid ||
      activeOccurrenceStart == null
    ) {
      return;
    }

    scrollActiveOccurrenceIntoView();
  }, [
    activeOccurrenceStart,
    activePassageUuid,
    scrollActiveOccurrenceIntoView,
    shouldScrollActiveOccurrence,
  ]);

  const onCardClick = (result: SearchResult) => {
    setOpen(false);
    onResultSelected(result);
  };

  const actionContext = useMemo<SearchActionContext>(
    () => ({
      activeOccurrence,
      activeOccurrenceIndex,
      activePassageLabel,
      activePassageUuid,
      moveActiveOccurrence,
      passageOccurrences,
      passages: results?.passages || [],
      refreshSearch,
      searchQuery,
      searching,
      scrollActiveOccurrenceIntoView,
      setActiveOccurrenceIndex,
      setShouldScrollActiveOccurrence,
    }),
    [
      activeOccurrence,
      activeOccurrenceIndex,
      activePassageLabel,
      activePassageUuid,
      moveActiveOccurrence,
      passageOccurrences,
      refreshSearch,
      results?.passages,
      scrollActiveOccurrenceIntoView,
      searchQuery,
      searching,
      setActiveOccurrenceIndex,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="bg-background my-auto [&_svg]:size-6 [&_svg]:stroke-1 hover:bg-background cursor-pointer text-base text-accent hover:text-accent/80"
        >
          <SearchIcon />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="bg-transparent top-4 max-w-4xl shadow-none border-0 text-secondary translate-y-0"
      >
        <DialogTitle className="hidden">Search</DialogTitle>
        <DialogDescription className="hidden">
          Search this translation
        </DialogDescription>
        <div className="flex flex-col justify-start gap-2 h-[calc(100vh-2.5rem)]">
          <div className="w-full flex flex-col gap-2 text-foreground shrink-0">
            <div className="flex justify-end">
              <Button
                className="text-secondary-foreground -me-3"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <XIcon className="size-3 my-auto" />
              </Button>
            </div>
            <Input
              autoFocus
              placeholder="Type to search..."
              value={searchQuery}
              className="w-full text-foreground px-4 py-6"
              onChange={(e) => {
                const nextValue = e.target.value;
                if (nextValue === searchQuery) {
                  return;
                }
                setActiveOccurrenceIndexState(0);
                pendingOccurrenceSelectionRef.current = null;
                setSearchQuery(nextValue);
              }}
            />
            {searchQuery && renderActions?.(actionContext)}
          </div>
          {searchQuery && (
            <>
              <div className="flex flex-col gap-3 text-sm text-secondary-foreground">
                <div>
                  Showing results for "<strong>{searchQuery}</strong>"
                  {searching && (
                    <Loader2Icon className="size-4 ml-2 animate-spin inline-block" />
                  )}
                </div>
              </div>
              {results && hasResults ? (
                <Tabs
                  defaultValue="alignments"
                  className="flex flex-col grow min-h-0 pt-2"
                >
                  <SearchResultTabs results={results} />
                  {RESULTS_ENTITIES.map(
                    (tab) =>
                      results[tab].length > 0 && (
                        <TabsContent
                          key={tab}
                          className="grow min-h-0"
                          value={tab}
                        >
                          <SearchResultsList
                            activeOccurrenceStart={(activeOccurrenceStart && shouldScrollActiveOccurrence) ? activeOccurrenceStart : undefined}
                            activePassageUuid={activePassageUuid}
                            query={searchQuery}
                            results={results[tab]}
                            onCardClick={onCardClick}
                          />
                        </TabsContent>
                      ),
                  )}
                </Tabs>
              ) : (
                <div className="mt-4 text-secondary-foreground">
                  No results found.
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
