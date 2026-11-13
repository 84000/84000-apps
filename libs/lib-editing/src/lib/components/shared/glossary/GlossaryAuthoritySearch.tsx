'use client';

import { useEffect, useId, useState } from 'react';
import {
  createBrowserClient,
  searchGlossaryAuthorities,
  type GlossaryAuthorityMatch,
  type GlossaryAuthorityName,
} from '@eightyfourthousand/data-access';
import {
  Button,
  DebounceLevel,
  Input,
} from '@eightyfourthousand/design-system';
import { cn, htmlToText } from '@eightyfourthousand/lib-utils';

import { nameLanguageLabel, tibetanScript } from './glossary-languages';

/** Names a result shows besides its headword. */
const SHOWN_NAMES = 4;
/** Characters of the standard definition a result shows. */
const DEFINITION_START = 160;

type Answer = {
  query: string;
  attempt: number;
  results: GlossaryAuthorityMatch[] | null;
};

type Search =
  | { status: 'idle' }
  | {
      status: 'searching';
      query: string;
      /** The last results, shown dimmed until the new ones arrive. */
      previous: GlossaryAuthorityMatch[] | null;
    }
  | { status: 'error'; query: string }
  | { status: 'done'; query: string; results: GlossaryAuthorityMatch[] };

/** The start of a definition as plain text, cut between words. */
export const definitionStart = (
  definition: string | null,
  length = DEFINITION_START,
): string => {
  const text = htmlToText(definition ?? '');
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const space = cut.lastIndexOf(' ');
  return `${(space > length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

/** The names a result shows: the matched one first, then one per language. */
export const shownAuthorityNames = (
  authority: GlossaryAuthorityMatch,
  count = SHOWN_NAMES,
): GlossaryAuthorityName[] => {
  const { matchedName, names, headword } = authority;
  const shown: GlossaryAuthorityName[] = matchedName ? [matchedName] : [];
  const languages = new Set(shown.map((n) => n.language));
  const others = names.filter(
    (n) => n.uuid !== matchedName?.uuid && n.content !== headword,
  );
  for (const name of others) {
    if (shown.length >= count) break;
    if (languages.has(name.language)) continue;
    languages.add(name.language);
    shown.push(name);
  }
  for (const name of others) {
    if (shown.length >= count) break;
    if (!shown.includes(name)) shown.push(name);
  }
  return shown;
};

/** One name: its language, the Tibetan script when it has one, its text. */
export const AuthorityNameLabel = ({
  name,
}: {
  name: GlossaryAuthorityName;
}) => (
  <span className="inline-flex flex-wrap items-baseline gap-x-2">
    <span className="text-muted-foreground">
      {nameLanguageLabel(name.language)}
    </span>
    {tibetanScript(name) && (
      <span className="font-tibetan text-base">{tibetanScript(name)}</span>
    )}
    <span className={name.language === 'en' ? '' : 'italic'}>
      {name.content}
    </span>
  </span>
);

/**
 * Search authorities by headword or any of their names, in any language,
 * and pick one. Never creates an authority.
 */
export const GlossaryAuthoritySearch = ({
  onSelect,
  currentUuid,
  autoFocus,
  disabled,
  boundedResults = true,
  className,
}: {
  /** Called with the result the editor picks. */
  onSelect: (authority: GlossaryAuthorityMatch) => void;
  /** An authority shown as already linked, and not offered. */
  currentUuid?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * Whether the results scroll in a box of their own. A host that scrolls,
   * such as a dialog, turns this off so the results scroll with it.
   */
  boundedResults?: boolean;
  className?: string;
}) => {
  const [query, setQuery] = useState('');
  // The last answer, kept by the query it answers.
  const [answer, setAnswer] = useState<Answer | null>(null);
  // Bumped to search the same query again after a failure.
  const [attempt, setAttempt] = useState(0);
  const listId = useId();
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    let current = true;
    searchGlossaryAuthorities({
      client: createBrowserClient(),
      query: trimmed,
    }).then((results) => {
      if (current) setAnswer({ query: trimmed, attempt, results });
    });
    return () => {
      current = false;
    };
  }, [trimmed, attempt]);

  const search: Search = !trimmed
    ? { status: 'idle' }
    : answer?.query !== trimmed || answer.attempt !== attempt
      ? {
          status: 'searching',
          query: trimmed,
          previous: answer?.results ?? null,
        }
      : answer.results
        ? { status: 'done', query: trimmed, results: answer.results }
        : { status: 'error', query: trimmed };

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      data-glossary-authority-search=""
    >
      <Input
        type="search"
        value={query}
        delay={DebounceLevel.MEDIUM}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search authorities by any name"
        aria-label="Search authorities"
        aria-controls={listId}
        autoFocus={autoFocus}
        disabled={disabled}
        // The browser's own clear button; the host offers a way out.
        className="[&::-webkit-search-cancel-button]:appearance-none"
      />
      <div id={listId} aria-live="polite">
        <AuthoritySearchResults
          search={search}
          currentUuid={currentUuid}
          onSelect={onSelect}
          onRetry={() => setAttempt((n) => n + 1)}
          disabled={disabled}
          bounded={boundedResults}
        />
      </div>
    </div>
  );
};

const AuthoritySearchResults = ({
  search,
  currentUuid,
  onSelect,
  onRetry,
  disabled,
  bounded,
}: {
  search: Search;
  currentUuid?: string;
  onSelect: (authority: GlossaryAuthorityMatch) => void;
  onRetry: () => void;
  disabled?: boolean;
  bounded: boolean;
}) => {
  if (search.status === 'idle') return null;
  if (search.status === 'searching') {
    if (!search.previous?.length) {
      return <p className="text-muted-foreground text-sm">Searching…</p>;
    }
    // The dimmed list shows the search; the line is for screen readers.
    return (
      <div>
        <p className="sr-only">Searching…</p>
        <AuthorityResultList
          results={search.previous}
          currentUuid={currentUuid}
          onSelect={onSelect}
          disabled={disabled}
          bounded={bounded}
          stale
        />
      </div>
    );
  }
  if (search.status === 'error') {
    return (
      <div role="alert" className="flex items-center gap-2 text-sm">
        <span className="text-destructive">
          The authorities could not be searched.
        </span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (!search.results.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No authority matches “{search.query}”.
      </p>
    );
  }
  return (
    <AuthorityResultList
      results={search.results}
      currentUuid={currentUuid}
      onSelect={onSelect}
      disabled={disabled}
      bounded={bounded}
    />
  );
};

/** The results to pick from; stale ones are dimmed while a search runs. */
const AuthorityResultList = ({
  results,
  currentUuid,
  onSelect,
  disabled,
  bounded,
  stale,
}: {
  results: GlossaryAuthorityMatch[];
  currentUuid?: string;
  onSelect: (authority: GlossaryAuthorityMatch) => void;
  disabled?: boolean;
  bounded: boolean;
  stale?: boolean;
}) => (
  <ul
    className={cn(
      '-mx-2 flex flex-col gap-1',
      bounded && 'max-h-96 overflow-y-auto',
      stale && 'opacity-60',
    )}
    aria-label="Matching authorities"
    aria-busy={stale || undefined}
  >
    {results.map((authority) => {
      const linked = authority.uuid === currentUuid;
      return (
        <li key={authority.uuid}>
          <button
            type="button"
            disabled={disabled || linked}
            onClick={() => onSelect(authority)}
            className="hover:bg-muted focus-visible:bg-muted flex w-full cursor-pointer flex-col gap-1 rounded-md p-2 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-60"
            data-authority-uuid={authority.uuid}
          >
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-primary font-sans text-base font-bold">
                {authority.headword}
              </span>
              <span className="text-muted-foreground text-xs">
                {nameLanguageLabel(authority.headwordLanguage)}
              </span>
              {linked && (
                <span className="text-primary text-xs">Linked now</span>
              )}
            </span>
            {shownAuthorityNames(authority).map((name) => (
              <AuthorityNameLabel key={name.uuid} name={name} />
            ))}
            {authority.definition && (
              <span className="leading-relaxed">
                {definitionStart(authority.definition)}
              </span>
            )}
          </button>
        </li>
      );
    })}
  </ul>
);
