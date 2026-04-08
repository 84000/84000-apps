'use client';

import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
} from '@eightyfourthousand/design-system';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

export interface SearchReplacePanelProps {
  activeOccurrenceIndex: number;
  activePassageLabel?: string;
  activePassageUuid?: string;
  canRunReplace: boolean;
  canStepBackward: boolean;
  canStepForward: boolean;
  passageOccurrencesCount: number;
  replaceDisabledReason?: string;
  replaceOpen: boolean;
  replaceQuery: string;
  replacing: boolean;
  onMoveNext: () => void;
  onMovePrevious: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onReplaceOpenChange: (open: boolean) => void;
  onReplaceQueryChange: (value: string) => void;
}

export const SearchReplacePanel = ({
  activeOccurrenceIndex,
  activePassageLabel,
  activePassageUuid,
  canRunReplace,
  canStepBackward,
  canStepForward,
  passageOccurrencesCount,
  replaceDisabledReason,
  replaceOpen,
  replaceQuery,
  replacing,
  onMoveNext,
  onMovePrevious,
  onReplace,
  onReplaceAll,
  onReplaceOpenChange,
  onReplaceQueryChange,
}: SearchReplacePanelProps) => {
  return (
    <Collapsible
      open={replaceOpen}
      onOpenChange={onReplaceOpenChange}
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
            onChange={(e) => onReplaceQueryChange(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-secondary-foreground">
            <span>
              {passageOccurrencesCount > 0 && activePassageUuid
                ? `Occurrence ${activeOccurrenceIndex + 1} of ${passageOccurrencesCount} in ${activePassageLabel || activePassageUuid}`
                : 'No exact passage occurrences available for replacement.'}
            </span>
            {replaceDisabledReason && <span>{replaceDisabledReason}</span>}
          </div>
          <div className="text-sm text-muted-foreground pb-4">
            Replace is case sensitive and is only applied to passages.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!canRunReplace} onClick={onReplace}>
              {replacing ? 'Replacing…' : 'Replace'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canRunReplace}
              onClick={onReplaceAll}
            >
              Replace all
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={!canStepBackward}
                onClick={onMovePrevious}
              >
                <ChevronRightIcon className="size-4 rotate-[-90deg]" />
                <span className="sr-only">Previous occurrence</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={!canStepForward}
                onClick={onMoveNext}
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
