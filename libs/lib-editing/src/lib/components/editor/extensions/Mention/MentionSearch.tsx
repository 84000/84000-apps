'use client';

import { Input } from '@eightyfourthousand/design-system';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useNavigation } from '../../../shared';
import {
  MentionLinkType,
  groupMentionResults,
  useMentionSearch,
} from './useMentionSearch';

/**
 * Entity picker used inside the mention hover card (edit mode). Mirrors
 * GlossarySearch: a debounced search input over the entity search. Results are
 * grouped by entity type and scoped to a work (defaults to the current work,
 * re-targetable via the toh field). Selecting a result reports its entity UUID,
 * link type, and label.
 */
export const MentionSearch = ({
  initialQuery = '',
  autoFocus = true,
  onSelect,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  onSelect: (result: {
    entity: string;
    linkType: MentionLinkType;
    label: string;
    isSameWork: boolean;
  }) => void;
}) => {
  const { toh: navToh } = useNavigation();
  const [query, setQuery] = useState(initialQuery);
  const [toh, setToh] = useState(navToh ?? '');
  const { results, loading } = useMentionSearch(query, toh);
  const groups = groupMentionResults(results);

  // A result is "same work" (in-panel navigation) only when it is a
  // work-internal type AND the searched work is the current document's work.
  const searchingCurrentWork = (toh.trim() || navToh) === navToh;

  return (
    <div className="flex flex-col gap-2 w-72">
      <div className="relative">
        <Input
          autoFocus={autoFocus}
          placeholder="Search works, passages, folios, glossary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && (
          <Loader2Icon className="absolute right-2 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">Work</span>
        <Input
          placeholder="toh…"
          className="h-7 text-xs"
          value={toh}
          onChange={(e) => setToh(e.target.value)}
        />
      </div>
      <div className="flex flex-col max-h-64 overflow-y-auto">
        {groups.length > 0
          ? groups.map((group) => (
              <div key={group.type} className="flex flex-col">
                <div className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <div
                    key={`${item.linkType}:${item.entity}`}
                    className="flex items-baseline gap-2 px-2 py-1.5 rounded-md cursor-pointer text-foreground hover:bg-muted"
                    onClick={() =>
                      onSelect({
                        entity: item.entity,
                        linkType: item.linkType,
                        label: item.label,
                        isSameWork:
                          item.linkType !== 'work' && searchingCurrentWork,
                      })
                    }
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
                ))}
              </div>
            ))
          : query.trim() &&
            !loading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No results
              </div>
            )}
      </div>
    </div>
  );
};
