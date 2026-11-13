'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBrowserClient,
  getGlossaryEntriesOfAuthority,
  searchGlossaryEntriesToCopy,
  type GlossaryCopySource,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import {
  Button,
  DebounceLevel,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@eightyfourthousand/design-system';
import { htmlToText, parseToh } from '@eightyfourthousand/lib-utils';

import type { StackController } from './StackController';
import { GlossaryRowNames } from './glossary-row';

/** Characters of a definition a result shows. */
const DEFINITION_START = 160;

const definitionStart = (definition: string | null) => {
  const text = htmlToText(definition ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > DEFINITION_START
    ? `${text.slice(0, DEFINITION_START).trimEnd()}…`
    : text;
};

type Search =
  | { status: 'idle' }
  | { status: 'searching'; query: string }
  | { status: 'error'; query: string }
  | { status: 'found'; query: string; results: GlossaryCopySource[] };

/** A search's answer, for the query it was run for. */
type Answer = { query: string; results: GlossaryCopySource[] | null };

/** This work's entries for the chosen entry's authority. */
type Existing =
  | { status: 'reading' }
  | { status: 'error' }
  | { status: 'read'; entries: GlossaryEntry[] };

/** This work's entries for an authority, as read. */
type ExistingRead = { authority: string; entries: GlossaryEntry[] | null };

/**
 * Search other works' glossaries and copy one of their entries into this
 * one, saying first when this work already has an entry for its authority.
 */
export const GlossaryCopyDialog = ({
  controller,
  open,
  onOpenChange,
}: {
  controller: StackController;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [chosen, setChosen] = useState<GlossaryCopySource | null>(null);
  const [read, setRead] = useState<ExistingRead | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef('');
  const workUuid = open ? controller.getGlossary()?.work.workUuid : undefined;

  const trimmed = query.trim();
  // Shown for the query typed, never an earlier one's answer.
  const search: Search = !trimmed
    ? { status: 'idle' }
    : answer?.query !== trimmed
      ? { status: 'searching', query: trimmed }
      : answer.results
        ? { status: 'found', query: trimmed, results: answer.results }
        : { status: 'error', query: trimmed };

  /** Leave the chosen entry for the results. */
  const back = useCallback(() => {
    setChosen(null);
    setRead(null);
    setError(null);
  }, []);

  // The input waits for typing to pause; a later query's answer replaces it.
  const changeQuery = useCallback(
    (next: string) => {
      setQuery(next);
      back();
      const typed = next.trim();
      latest.current = typed;
      if (!workUuid || !typed) return;
      searchGlossaryEntriesToCopy({
        client: createBrowserClient(),
        workUuid,
        query: typed,
      })
        .catch((cause) => {
          console.error('Failed to search other works:', cause);
          return null;
        })
        .then((results) => {
          // An earlier query's late answer must not replace a later one's.
          if (latest.current === typed) setAnswer({ query: typed, results });
        });
    },
    [workUuid, back],
  );

  const authority = chosen?.entry.authorityUuid;
  const existing: Existing | null = !authority
    ? null
    : read?.authority !== authority
      ? { status: 'reading' }
      : read.entries
        ? { status: 'read', entries: read.entries }
        : { status: 'error' };

  useEffect(() => {
    if (!authority || !workUuid) return;
    let current = true;
    getGlossaryEntriesOfAuthority({
      client: createBrowserClient(),
      workUuid,
      authorityUuid: authority,
    })
      .catch((cause) => {
        console.error('Failed to read entries of the authority:', cause);
        return null;
      })
      .then((entries) => {
        if (current) setRead({ authority, entries });
      });
    return () => {
      current = false;
    };
  }, [authority, workUuid]);

  const reset = useCallback(() => {
    setQuery('');
    latest.current = '';
    setAnswer(null);
    setChosen(null);
    setRead(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    if (pending) return;
    reset();
    onOpenChange(false);
  }, [pending, reset, onOpenChange]);

  const handleCopy = useCallback(async () => {
    if (!chosen) return;
    setPending(true);
    setError(null);
    try {
      const result = await controller.copyGlossaryEntry(chosen.entry, {
        client: createBrowserClient(),
      });
      if (result.copied) {
        reset();
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    } catch (cause) {
      console.error('Failed to copy glossary entry:', cause);
      setError('something went wrong.');
    } finally {
      setPending(false);
    }
  }, [chosen, controller, reset, onOpenChange]);

  const already = existing?.status === 'read' ? existing.entries : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="max-w-readable w-full font-serif"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Copy from Another Work</DialogTitle>
          <DialogDescription>
            {chosen
              ? 'The copy is a new entry in this work, with the same authority, names and definition. The entry it is copied from does not change.'
              : 'Search the glossaries of other works by English, Tibetan or Sanskrit name.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            disabled={pending}
            delay={DebounceLevel.MEDIUM}
            aria-label="Search other works"
            placeholder="Whole words of an English, Tibetan or Sanskrit name"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
          />
          {chosen ? (
            <div className="flex flex-col gap-3" data-glossary-copy-chosen="">
              <GlossaryCopySourceCard source={chosen} />
              <GlossaryCopyExisting
                existing={existing}
                labelOf={(uuid) => controller.getMeta(uuid)?.label}
              />
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  The entry was not copied: {error}
                </p>
              )}
            </div>
          ) : (
            <GlossaryCopyResults search={search} onChoose={setChosen} />
          )}
        </div>

        <DialogFooter>
          {chosen ? (
            <>
              <Button variant="outline" disabled={pending} onClick={back}>
                Back
              </Button>
              <Button
                disabled={pending || existing?.status === 'reading'}
                onClick={handleCopy}
              >
                {pending ? 'Copying…' : already.length ? 'Copy anyway' : 'Copy'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** One entry of another work: where it is from, its names and definition. */
const GlossaryCopySourceCard = ({ source }: { source: GlossaryCopySource }) => {
  const { entry, work, label, headword } = source;
  const definition = definitionStart(entry.definition);
  return (
    <div className="flex flex-col gap-1 text-left" data-glossary-copy-source="">
      <div className="text-muted-foreground flex flex-wrap gap-x-2 font-sans text-xs">
        {work.toh && <span className="font-bold">{parseToh(work.toh)}</span>}
        {work.title && <span>{work.title}</span>}
        <span>{label}</span>
      </div>
      <GlossaryRowNames entry={entry} />
      {definition && <p className="text-sm leading-relaxed">{definition}</p>}
      {headword && (
        <p className="text-muted-foreground text-xs">
          Authority: <span>{headword}</span>
        </p>
      )}
    </div>
  );
};

const GlossaryCopyResults = ({
  search,
  onChoose,
}: {
  search: Search;
  onChoose: (source: GlossaryCopySource) => void;
}) => {
  if (search.status === 'idle') return null;
  if (search.status === 'searching') {
    return <p className="text-muted-foreground text-sm">Searching…</p>;
  }
  if (search.status === 'error') {
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        The search could not be run.
      </p>
    );
  }
  if (!search.results.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No entry in another work matches “{search.query}”.
      </p>
    );
  }
  return (
    <ul
      className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md border p-1"
      aria-label="Entries in other works"
    >
      {search.results.map((source) => (
        <li key={source.entry.uuid}>
          <button
            type="button"
            className="hover:bg-accent focus-visible:bg-accent w-full rounded-md p-2 text-left outline-none"
            onClick={() => onChoose(source)}
          >
            <GlossaryCopySourceCard source={source} />
          </button>
        </li>
      ))}
    </ul>
  );
};

/** This work's entries for the same authority, if it has any. */
const GlossaryCopyExisting = ({
  existing,
  labelOf,
}: {
  existing: Existing | null;
  labelOf: (uuid: string) => string | undefined;
}) => {
  if (!existing || existing.status === 'reading') {
    return (
      <p className="text-muted-foreground text-sm">
        Checking this work’s glossary…
      </p>
    );
  }
  if (existing.status === 'error') {
    return (
      <p className="text-muted-foreground text-sm">
        This work’s entries for the same authority could not be read.
      </p>
    );
  }
  if (!existing.entries.length) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm"
      data-glossary-copy-existing=""
    >
      <p className="font-medium">
        This work already has{' '}
        {existing.entries.length === 1
          ? 'an entry'
          : `${existing.entries.length} entries`}{' '}
        for this authority:
      </p>
      <ul className="flex flex-col gap-2">
        {existing.entries.map((entry) => {
          const label = labelOf(entry.uuid);
          const definition = definitionStart(entry.definition);
          return (
            <li key={entry.uuid} className="flex flex-col gap-1">
              {label && (
                <span className="text-muted-foreground font-sans text-xs">
                  {label}
                </span>
              )}
              <GlossaryRowNames entry={entry} />
              {definition && <p className="leading-relaxed">{definition}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
