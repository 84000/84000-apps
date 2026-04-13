'use client';

import {
  createGraphQLClient,
  replace,
  type ReplacedPassage,
} from '@eightyfourthousand/client-graphql';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
} from '@eightyfourthousand/design-system';
import type { SearchActionContext } from '@eightyfourthousand/lib-search';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const REPLACE_CHUNK_SIZE = 200;

export interface SearchReplacePanelProps {
  canReplace: boolean;
  onPassagesReplaced?: (passages: ReplacedPassage[]) => Promise<void> | void;
  replaceDisabledReason?: string;
  searchContext: SearchActionContext;
}

export const SearchReplacePanel = ({
  canReplace,
  onPassagesReplaced,
  replaceDisabledReason,
  searchContext,
}: SearchReplacePanelProps) => {
  const client = useMemo(() => createGraphQLClient(), []);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [replacing, setReplacing] = useState(false);

  const canRunReplace =
    canReplace &&
    !replaceDisabledReason &&
    !!searchContext.searchQuery &&
    !!replaceQuery &&
    searchContext.passageOccurrences.length > 0 &&
    !replacing;
  const canStepBackward =
    replaceOpen && searchContext.activeOccurrenceIndex > 0;
  const canStepForward =
    replaceOpen &&
    searchContext.activeOccurrenceIndex <
      searchContext.passageOccurrences.length - 1;

  useEffect(() => {
    searchContext.setShouldScrollActiveOccurrence(replaceOpen);

    return () => {
      searchContext.setShouldScrollActiveOccurrence(false);
    };
  }, [replaceOpen, searchContext]);

  useEffect(() => {
    if (!replaceOpen || searchContext.passageOccurrences.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        searchContext.moveActiveOccurrence('previous');
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        searchContext.moveActiveOccurrence('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replaceOpen, searchContext]);

  if (!canReplace || !searchContext.searchQuery) {
    return null;
  }

  const runReplace = async ({ replaceAll }: { replaceAll: boolean }) => {
    if (!canRunReplace) {
      return;
    }

    setReplacing(true);

    try {
      if (replaceAll) {
        const targetUuids = searchContext.passages.map((passage) => passage.uuid);
        if (targetUuids.length === 0) {
          return;
        }

        const allReplacedPassages: ReplacedPassage[] = [];
        for (let i = 0; i < targetUuids.length; i += REPLACE_CHUNK_SIZE) {
          const chunk = targetUuids.slice(i, i + REPLACE_CHUNK_SIZE);
          const response = await replace({
            client,
            searchText: searchContext.searchQuery,
            replaceText: replaceQuery,
            targetUuids: chunk,
          });

          if (!response.success) {
            console.error(`Replace failed: ${response.error ?? 'unknown error'}`);
            return;
          }

          allReplacedPassages.push(...response.passages);
        }

        await onPassagesReplaced?.(allReplacedPassages);
        await searchContext.refreshSearch({ nextSelection: { kind: 'index', index: 0 } });
        return;
      }

      // Single replace: target only the active passage and use its exact position as the cursor.
      const activeOccurrence = searchContext.activeOccurrence;
      if (!activeOccurrence) {
        return;
      }

      const response = await replace({
        client,
        searchText: searchContext.searchQuery,
        replaceText: replaceQuery,
        targetUuids: [activeOccurrence.passageUuid],
        cursorPassageUuid: activeOccurrence.passageUuid,
        cursorStart: activeOccurrence.start,
      });

      if (!response.success) {
        console.error(`Replace failed: ${response.error ?? 'unknown error'}`);
        return;
      }

      await onPassagesReplaced?.(response.passages);

      const nextSelection =
        response.nextPassageUuid != null && response.nextOccurrenceStart != null
          ? {
              kind: 'cursor' as const,
              passageUuid: response.nextPassageUuid,
              start: response.nextOccurrenceStart,
            }
          : {
              kind: 'index' as const,
              index: Math.min(
                searchContext.activeOccurrenceIndex + 1,
                Math.max(searchContext.passageOccurrences.length - 1, 0),
              ),
            };

      await searchContext.refreshSearch({ nextSelection });
    } catch (error) {
      console.error('Replace failed:', error);
    } finally {
      setReplacing(false);
    }
  };

  return (
    <Collapsible
      open={replaceOpen}
      onOpenChange={setReplaceOpen}
      className="bg-background border rounded-lg px-4 py-3 text-foreground"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group/collapsible flex w-full items-center justify-start gap-2 text-left text-sm font-medium cursor-pointer"
        >
          <ChevronRightIcon className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          <span>Replace</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="flex flex-col">
          <Input
            id="replace-query"
            placeholder="Replace with..."
            value={replaceQuery}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (nextValue === replaceQuery) {
                return;
              }
              setReplaceQuery(nextValue);
              if (nextValue) {
                searchContext.scrollActiveOccurrenceIntoView();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-secondary-foreground">
            <span>
              {searchContext.passageOccurrences.length > 0 &&
              searchContext.activePassageUuid
                ? `Occurrence ${searchContext.activeOccurrenceIndex + 1} of ${searchContext.passageOccurrences.length} in ${searchContext.activePassageLabel || searchContext.activePassageUuid}`
                : 'No exact passage occurrences available for replacement.'}
            </span>
            {replaceDisabledReason && <span>{replaceDisabledReason}</span>}
          </div>
          <div className="text-sm text-muted-foreground pb-4">
            Replace is case sensitive and is only applied to passages.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!canRunReplace}
              onClick={() => void runReplace({ replaceAll: false })}
            >
              {replacing ? 'Replacing…' : 'Replace'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canRunReplace}
              onClick={() => void runReplace({ replaceAll: true })}
            >
              Replace all
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={!canStepBackward}
                onClick={() => {
                  searchContext.moveActiveOccurrence('previous');
                }}
              >
                <ChevronRightIcon className="size-4 rotate-[-90deg]" />
                <span className="sr-only">Previous occurrence</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={!canStepForward}
                onClick={() => {
                  searchContext.moveActiveOccurrence('next');
                }}
              >
                <ChevronDownIcon className="size-4" />
                <span className="sr-only">Next occurrence</span>
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
