'use client';

import { Input } from '@eightyfourthousand/design-system';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  MentionLinkType,
  groupMentionResults,
  useMentionSearch,
} from './useMentionSearch';

/**
 * Entity picker used inside the mention hover card (edit mode). Mirrors
 * GlossarySearch: a debounced search input over the entity search, scoped to
 * the current work. Results are grouped by entity type; selecting a result
 * reports its entity UUID, link type, and label.
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
  }) => void;
}) => {
  const [query, setQuery] = useState(initialQuery);
  const { results, loading } = useMentionSearch(query);
  const groups = groupMentionResults(results);

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
