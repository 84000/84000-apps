'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  createBrowserClient,
  createGlossaryEntry,
  findGlossaryEntryMatches,
  type GlossaryAuthorityMatch,
  type GlossaryEntry,
  type GlossaryEntryMatch,
} from '@eightyfourthousand/data-access';
import { Button, Label } from '@eightyfourthousand/design-system';
import { cn, escapeHtml } from '@eightyfourthousand/lib-utils';

import {
  AuthorityNameLabel,
  GlossaryAuthoritySearch,
  shownAuthorityNames,
} from './GlossaryAuthoritySearch';
import { nameLanguageLabel } from './glossary-languages';

/** How long typing in the name rests before duplicates are looked for. */
const MATCH_DELAY_MS = 300;

/** A typed definition as stored HTML: a paragraph per blank-line block. */
export const definitionFromText = (text: string): string | null => {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
};

/** The duplicates found for one name and authority. */
type Matches = { key: string; matches: GlossaryEntryMatch[] };

const matchKey = (english: string, authority?: string) =>
  `${english.toLocaleLowerCase()}\n${authority ?? ''}`;

/**
 * A short form that creates a glossary entry of `workUuid`: its English name,
 * an existing authority, and optionally a definition. It never creates an
 * authority. Entries of the work that it may duplicate are listed, and
 * creating anyway is allowed.
 */
export const GlossaryEntryForm = ({
  workUuid,
  initialEnglish = '',
  onCreated,
  onCancel,
  onPickExisting,
  className,
}: {
  workUuid: string;
  initialEnglish?: string;
  /** Called with the entry as stored, once it is created. */
  onCreated: (entry: GlossaryEntry) => void | Promise<void>;
  onCancel: () => void;
  /** When given, each possible duplicate can be picked instead. */
  onPickExisting?: (match: GlossaryEntryMatch) => void;
  className?: string;
}) => {
  const [english, setEnglish] = useState(initialEnglish);
  const [authority, setAuthority] = useState<GlossaryAuthorityMatch | null>(
    null,
  );
  const [definition, setDefinition] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Matches | null>(null);
  const nameId = useId();
  const definitionId = useId();

  const name = english.trim();
  const key = matchKey(name, authority?.uuid);
  const matches = found?.key === key ? found.matches : [];

  useEffect(() => {
    if (!name && !authority) return;
    let current = true;
    const timer = setTimeout(() => {
      findGlossaryEntryMatches({
        client: createBrowserClient(),
        workUuid,
        english: name,
        authorityUuid: authority?.uuid,
      }).then((result) => {
        if (current) setFound({ key, matches: result ?? [] });
      });
    }, MATCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [workUuid, name, authority, key]);

  const ready = !!name && !!authority && !pending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !authority) return;
    setPending(true);
    setError(null);
    try {
      const result = await createGlossaryEntry({
        client: createBrowserClient(),
        workUuid,
        entry: {
          authorityUuid: authority.uuid,
          definition: definitionFromText(definition),
          names: [
            {
              language: 'en',
              content: name,
              contentTransformed: null,
              termType: 'translationMain',
              attestation: null,
            },
          ],
        },
      });
      const [entry] = result.success ? result.entries : [];
      if (!entry) {
        setError(result.success ? 'The entry was not created.' : result.error);
        setPending(false);
        return;
      }
      await onCreated(entry);
    } catch (cause) {
      console.error('Failed to create glossary entry:', cause);
      setError('Something went wrong.');
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn('flex flex-col gap-3 text-sm', className)}
      data-glossary-entry-form=""
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={nameId}>English name</Label>
        {/* Not the design system's Input, whose change lags its value. */}
        <input
          id={nameId}
          value={english}
          onChange={(event) => setEnglish(event.target.value)}
          disabled={pending}
          autoFocus
          className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Authority</span>
        {authority ? (
          <ChosenAuthority
            authority={authority}
            disabled={pending}
            onChange={() => setAuthority(null)}
          />
        ) : (
          <GlossaryAuthoritySearch onSelect={setAuthority} disabled={pending} />
        )}
        <p className="text-muted-foreground text-xs">
          New authorities are added through the agent tools.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={definitionId}>Definition</Label>
        <textarea
          id={definitionId}
          value={definition}
          onChange={(event) => setDefinition(event.target.value)}
          disabled={pending}
          placeholder="Optional"
          className="border-input bg-background placeholder:text-muted-foreground min-h-16 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {!!matches.length && (
        <PossibleDuplicates
          matches={matches}
          onPick={onPickExisting}
          disabled={pending}
        />
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          The entry was not created: {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!ready}>
          Create entry
        </Button>
      </div>
    </form>
  );
};

/** The authority picked, with a way back to the search. */
const ChosenAuthority = ({
  authority,
  disabled,
  onChange,
}: {
  authority: GlossaryAuthorityMatch;
  disabled: boolean;
  onChange: () => void;
}) => (
  <div
    className="flex items-start justify-between gap-2 rounded-md border p-2"
    data-chosen-authority={authority.uuid}
  >
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{authority.headword}</span>
        <span className="text-muted-foreground text-xs">
          {nameLanguageLabel(authority.headwordLanguage)}
        </span>
      </span>
      {shownAuthorityNames(authority).map((name) => (
        <AuthorityNameLabel key={name.uuid} name={name} />
      ))}
    </div>
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={disabled}
      onClick={onChange}
    >
      Change
    </Button>
  </div>
);

/** Entries of the work the new one may duplicate. */
const PossibleDuplicates = ({
  matches,
  onPick,
  disabled,
}: {
  matches: GlossaryEntryMatch[];
  onPick?: (match: GlossaryEntryMatch) => void;
  disabled: boolean;
}) => (
  <div className="flex flex-col gap-1" data-glossary-duplicates="">
    <span className="font-medium">Possible duplicates</span>
    <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
      {matches.map((match) => (
        <li
          key={match.uuid}
          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-primary font-sans text-xs font-bold">
              {match.label}
            </span>
            <span>{match.english ?? '(no English)'}</span>
            <span className="text-muted-foreground text-xs">
              {[
                match.sameName && 'same name',
                match.sameAuthority && 'same authority',
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </span>
          {onPick && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onPick(match)}
            >
              Link to this
            </Button>
          )}
        </li>
      ))}
    </ul>
  </div>
);
