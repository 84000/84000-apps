'use client';

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
import { getPassageOccurrences } from '@eightyfourthousand/data-access';
import {
  createGraphQLClient,
  replace,
  type ReplacedPassage,
} from '@eightyfourthousand/client-graphql';
import { Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { search } from '../data';
import { RESULTS_ENTITIES, SearchResult, SearchResults } from '../types';
import { SearchReplacePanel } from './SearchReplacePanel';
import { SearchResultsList } from './SearchResultsList';
import { SearchResultTabs } from './SearchResultTab';

export const SearchButton = ({
  canReplace = false,
  onPassagesReplaced,
  workUuid,
  replaceDisabledReason,
  toh,
  onResultSelected,
}: {
  canReplace?: boolean;
  onPassagesReplaced?: (passages: ReplacedPassage[]) => Promise<void> | void;
  workUuid?: string;
  replaceDisabledReason?: string;
  toh?: string;
  onResultSelected: (result: SearchResult) => void;
}) => {
  const client = useMemo(() => createGraphQLClient(), []);
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults>();
  const [activeOccurrenceIndex, setActiveOccurrenceIndex] = useState(0);
  const [nextReplaceCursor, setNextReplaceCursor] = useState<{
    passageUuid?: string | null;
    start?: number | null;
  } | null>(null);
  const pendingOccurrenceSelectionRef = useRef<
    | { kind: 'index'; index: number }
    | { kind: 'cursor'; start: number; passageUuid: string }
    | null
  >(null);

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
  const hasNextReplaceCursor =
    nextReplaceCursor?.passageUuid != null && nextReplaceCursor?.start != null;
  const canRunReplace =
    canReplace &&
    !replaceDisabledReason &&
    !!searchQuery &&
    !!replaceQuery &&
    passageOccurrences.length > 0 &&
    !replacing;
  const canStepOccurrences = replaceOpen && passageOccurrences.length > 0;
  const canStepBackward = canStepOccurrences && activeOccurrenceIndex > 0;
  const canStepForward =
    canStepOccurrences && activeOccurrenceIndex < passageOccurrences.length - 1;

  const runSearch = async ({
    nextOccurrenceIndex,
    preservePendingSelection = false,
  }: {
    nextOccurrenceIndex?: number | null;
    preservePendingSelection?: boolean;
  } = {}) => {
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
    if (!preservePendingSelection) {
      pendingOccurrenceSelectionRef.current =
        nextOccurrenceIndex === undefined || nextOccurrenceIndex === null
          ? null
          : { kind: 'index', index: nextOccurrenceIndex };
    }
    setSearching(false);
  };

  const onCardClick = (result: SearchResult) => {
    setOpen(false);
    onResultSelected(result);
  };

  useEffect(() => {
    const performSearch = async () => {
      await runSearch();
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, workUuid, toh]);

  useEffect(() => {
    setResults(undefined);
    setSearchQuery('');
    setReplaceOpen(false);
    setReplaceQuery('');
    setActiveOccurrenceIndex(0);
    setNextReplaceCursor(null);
    pendingOccurrenceSelectionRef.current = null;
  }, [open]);

  useEffect(() => {
    if (passageOccurrences.length === 0) {
      setActiveOccurrenceIndex(0);
      pendingOccurrenceSelectionRef.current = null;
      return;
    }

    const pendingSelection = pendingOccurrenceSelectionRef.current;
    if (pendingSelection) {
      if (pendingSelection.kind === 'index') {
        setActiveOccurrenceIndex(
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

        if (pendingSelection.kind !== 'cursor') {
          return false;
        }

        return false;
      });

      if (nextIndex >= 0) {
        setActiveOccurrenceIndex(nextIndex);
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

      setActiveOccurrenceIndex(nextPassageIndex >= 0 ? nextPassageIndex : 0);
      pendingOccurrenceSelectionRef.current = null;
      return;
    }

    setActiveOccurrenceIndex((current) =>
      Math.min(current, passageOccurrences.length - 1),
    );
  }, [passageOccurrences]);

  useEffect(() => {
    if (
      !replaceOpen ||
      !activePassageUuid ||
      activeOccurrenceStart == null
    ) {
      return;
    }

    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-search-result-active="true"]')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    });
  }, [activeOccurrenceStart, activePassageUuid, replaceOpen]);

  const moveActiveOccurrence = (direction: 'next' | 'previous') => {
    if (passageOccurrences.length === 0) {
      return;
    }

    setNextReplaceCursor(null);
    pendingOccurrenceSelectionRef.current = null;
    setActiveOccurrenceIndex((current) => {
      if (direction === 'previous') {
        return Math.max(current - 1, 0);
      }

      return Math.min(current + 1, passageOccurrences.length - 1);
    });
  };

  useEffect(() => {
    if (!open || !replaceOpen || passageOccurrences.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveActiveOccurrence('previous');
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveActiveOccurrence('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, passageOccurrences.length, replaceOpen]);

  const runReplace = async ({ replaceAll }: { replaceAll: boolean }) => {
    if (!canRunReplace) {
      return;
    }

    const targetUuids = results?.passages.map((passage) => passage.uuid) || [];

    if (targetUuids.length === 0) {
      return;
    }

    setReplacing(true);

    try {
      const replaceRequest = {
        searchText: searchQuery,
        replaceText: replaceQuery,
        targetUuids,
        occurrenceIndex:
          replaceAll || hasNextReplaceCursor ? undefined : activeOccurrenceIndex,
        cursorPassageUuid:
          replaceAll || !hasNextReplaceCursor
            ? undefined
            : nextReplaceCursor?.passageUuid ?? undefined,
        cursorStart:
          replaceAll || !hasNextReplaceCursor
            ? undefined
            : nextReplaceCursor?.start ?? undefined,
      };

      const response = await replace({ client, ...replaceRequest });

      if (!response.success) {
        console.error(`Replace failed: ${response.error ?? 'unknown error'}`);
        return;
      }

      await onPassagesReplaced?.(response.passages);
      if (replaceAll) {
        setNextReplaceCursor(null);
        await runSearch({
          nextOccurrenceIndex: 0,
        });
      } else {
        setNextReplaceCursor(
          response.nextPassageUuid != null &&
            response.nextOccurrenceStart != null
            ? {
              passageUuid: response.nextPassageUuid,
              start: response.nextOccurrenceStart,
            }
            : null,
        );
        pendingOccurrenceSelectionRef.current =
          response.nextPassageUuid != null &&
            response.nextOccurrenceStart != null
            ? {
              kind: 'cursor',
              passageUuid: response.nextPassageUuid,
              start: response.nextOccurrenceStart,
            }
            : activeOccurrence
              ? {
                kind: 'index',
                index: Math.min(
                  activeOccurrenceIndex + 1,
                  Math.max(passageOccurrences.length - 1, 0),
                ),
              }
              : null;
        await runSearch({ preservePendingSelection: true });
      }
    } catch (error) {
      console.error('Replace failed:', error);
    } finally {
      setReplacing(false);
    }
  };

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
                setActiveOccurrenceIndex(0);
                setNextReplaceCursor(null);
                pendingOccurrenceSelectionRef.current = null;
                setSearchQuery(nextValue);
              }}
            />
            {canReplace && searchQuery && (
              <SearchReplacePanel
                activeOccurrenceIndex={activeOccurrenceIndex}
                activePassageLabel={activePassageLabel}
                activePassageUuid={activePassageUuid}
                canRunReplace={canRunReplace}
                canStepBackward={canStepBackward}
                canStepForward={canStepForward}
                passageOccurrencesCount={passageOccurrences.length}
                replaceDisabledReason={replaceDisabledReason}
                replaceOpen={replaceOpen}
                replaceQuery={replaceQuery}
                replacing={replacing}
                onMoveNext={() => moveActiveOccurrence('next')}
                onMovePrevious={() => moveActiveOccurrence('previous')}
                onReplace={() => runReplace({ replaceAll: false })}
                onReplaceAll={() => runReplace({ replaceAll: true })}
                onReplaceOpenChange={setReplaceOpen}
                onReplaceQueryChange={(nextValue) => {
                  if (nextValue === replaceQuery) {
                    return;
                  }
                  setNextReplaceCursor(null);
                  setReplaceQuery(nextValue);
                }}
              />
            )}
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
                  defaultValue="passages"
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
                            activeOccurrenceStart={activeOccurrence?.start}
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
