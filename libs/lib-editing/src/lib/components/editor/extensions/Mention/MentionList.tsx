'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { Loader2Icon, SlidersHorizontalIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { MentionStorage } from './Mention';
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
 * this component owns the debounced search, keyboard navigation, and selection.
 * Results are grouped by entity type (Notion-style) and scoped to the current
 * work; keyboard navigation runs across the flattened, grouped order. The
 * "Advanced" button hands off to a dedicated dialog that can search any work
 * (a focusable field cannot live in this suggestion popup without closing it).
 */
const MentionList = forwardRef<
  MentionListHandle,
  SuggestionProps<MentionSearchResult>
>((props, ref) => {
  const { results, loading } = useMentionSearch(props.query);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const openAdvanced = () => {
    const { editor, range, query } = props;
    const pos = range.from;
    const storage = editor.storage.mention as MentionStorage | undefined;
    // Remove the `@…` trigger so the suggestion exits, then hand off to the
    // stable overlay (which owns its own focus and work scope).
    editor.chain().focus().deleteRange(range).run();
    storage?.openAdvanced?.({ pos, query });
  };

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
    <div className="z-50 bg-popover flex flex-col rounded-md border shadow-md p-1 w-80">
      <div className="flex flex-col max-h-[280px] overflow-y-auto">
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
      <div className="border-t mt-1 pt-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={openAdvanced}
        >
          <SlidersHorizontalIcon className="size-4" />
          Advanced search…
        </button>
      </div>
    </div>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;
