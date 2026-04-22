'use client';

import { Input, Separator } from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  searchWorkGlossaryTerms,
} from '@eightyfourthousand/client-graphql';
import { Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '../../../shared';

export interface GlossarySearchResult {
  glossary: string;
  authority: string;
  english: string | null;
  tibetan: string | null;
  wylie: string | null;
}

const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 20;

export const GlossarySearch = ({
  initialQuery = '',
  autoFocus = true,
  onSelect,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  onSelect: (result: GlossarySearchResult) => void;
}) => {
  const { uuid: workUuid } = useNavigation();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<GlossarySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !workUuid) {
        setResults([]);
        return;
      }

      setLoading(true);
      const client = createGraphQLClient();
      const nodes = await searchWorkGlossaryTerms({
        client,
        uuid: workUuid,
        query: query.trim(),
        limit: SEARCH_LIMIT,
      });

      setResults(
        nodes.map((n) => ({
          glossary: n.uuid,
          authority: n.authority,
          english: n.names.english,
          tibetan: n.names.tibetan,
          wylie: n.names.wylie,
        })),
      );
      setLoading(false);
    },
    [workUuid],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, runSearch]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        placeholder="Search glossary by English term..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 text-sm"
      />

      {loading && (
        <div className="flex items-center justify-center py-2">
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
          {results.map((result) => (
            <button
              key={result.glossary}
              className="flex items-start gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer text-left w-full"
              onClick={() => onSelect(result)}
            >
              <span className="font-medium text-primary shrink-0">
                {result.english || '(no English)'}
              </span>
              {(result.wylie || result.tibetan) && (
                <span className="text-muted-foreground truncate">
                  {result.wylie || result.tibetan}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && searchQuery && results.length === 0 && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground text-center py-1">
            No matching glossary terms found.
          </p>
        </>
      )}
    </div>
  );
};
