'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { Loader2Icon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  MentionSearchResult,
  groupMentionResults,
  useMentionSearch,
} from './useMentionSearch';

export interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

/**
 * The `@` mention dropdown. The suggestion plugin supplies the typed `query`;
 * this component owns the debounced lib-search lookup, keyboard navigation, and
 * selection. Results are grouped by entity type (Notion-style); keyboard
 * navigation runs across the flattened, grouped order.
 */
const MentionList = forwardRef<
  MentionListHandle,
  SuggestionProps<MentionSearchResult>
>((props, ref) => {
  const { results, loading } = useMentionSearch(props.query);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const groups = useMemo(() => groupMentionResults(results), [results]);
  // Flattened, grouped order — what selectedIndex and the arrow keys index into.
  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const indexOf = useMemo(() => {
    const map = new Map<MentionSearchResult, number>();
    ordered.forEach((item, i) => map.set(item, i));
    return map;
  }, [ordered]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [ordered]);

  const selectItem = (index: number) => {
    const item = ordered[index];
    if (item) {
      props.command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (ordered.length === 0) {
        return false;
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + ordered.length - 1) % ordered.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % ordered.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="z-50 bg-popover flex flex-col rounded-md border shadow-md p-1 max-h-[320px] w-80 overflow-y-auto">
      {ordered.length > 0 ? (
        groups.map((group) => (
          <div key={group.type} className="flex flex-col">
            <div className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((item) => {
              const index = indexOf.get(item) ?? -1;
              return (
                <div
                  key={`${item.linkType}:${item.entity}`}
                  className={cn(
                    'flex items-baseline gap-2 px-2 py-1.5 rounded-md cursor-pointer text-foreground hover:bg-muted',
                    { 'bg-muted': index === selectedIndex },
                  )}
                  onClick={() => props.command(item)}
                >
                  <span className="shrink-0 font-medium text-sm text-accent">
                    {item.label}
                  </span>
                  {item.text && (
                    <span className="text-sm truncate text-foreground">
                      {item.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          {loading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Searching…
            </>
          ) : props.query.trim() ? (
            'No results'
          ) : (
            'Type to search entities…'
          )}
        </div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;
