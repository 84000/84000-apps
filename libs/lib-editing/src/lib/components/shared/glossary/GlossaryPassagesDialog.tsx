'use client';

import {
  createGraphQLClient,
  getGlossaryTermExcerpts,
  type GlossaryPassageExcerpt,
} from '@eightyfourthousand/client-graphql';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigation } from '../NavigationContext';
import { locationForPassageType } from '../types';
import { GlossaryInstancesTable } from './GlossaryInstancesTable';

/** Passages shown per page. */
export const GLOSSARY_PASSAGES_PAGE_SIZE = 20;

/** The glossary entry whose passages the dialog lists. */
export type GlossaryPassagesTerm = {
  uuid: string;
  english?: string | null;
};

type GlossaryPassagesContextValue = {
  openGlossaryPassages: (term: GlossaryPassagesTerm) => void;
};

const GlossaryPassagesContext = createContext<
  GlossaryPassagesContextValue | undefined
>(undefined);

/**
 * Opens the glossary passages dialog, or undefined outside a
 * {@link GlossaryPassagesProvider}.
 */
export const useGlossaryPassages = () => useContext(GlossaryPassagesContext);

/**
 * Holds the glossary passages dialog above whatever opens it, so the dialog
 * outlives a hover card that closes as it opens.
 */
export const GlossaryPassagesProvider = ({
  instances = false,
  children,
}: {
  /** Whether the dialog has the editor's "Instances" tab. */
  instances?: boolean;
  children: ReactNode;
}) => {
  const [term, setTerm] = useState<GlossaryPassagesTerm>();
  const value = useMemo(() => ({ openGlossaryPassages: setTerm }), []);

  return (
    <GlossaryPassagesContext.Provider value={value}>
      {children}
      <GlossaryPassagesDialog
        term={term}
        instances={instances}
        onClose={() => setTerm(undefined)}
      />
    </GlossaryPassagesContext.Provider>
  );
};

type LoadState = 'idle' | 'loading' | 'error';

const countLabel = (count: number, one: string, many: string) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

/**
 * Lists every passage that cites a glossary entry, a page at a time. With
 * `instances`, a second tab lists each instance.
 */
export const GlossaryPassagesDialog = ({
  term,
  instances = false,
  onClose,
}: {
  term?: GlossaryPassagesTerm;
  instances?: boolean;
  onClose: () => void;
}) => {
  const { toh, updatePanel } = useNavigation();
  const [items, setItems] = useState<GlossaryPassageExcerpt[]>([]);
  const [totalCount, setTotalCount] = useState<number>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [tab, setTab] = useState<'passages' | 'instances'>('passages');
  // Each read gets a number; a read answers only if it is still the latest, so
  // a slow page for an earlier entry or Toh never lands in this one.
  const readRef = useRef(0);

  const load = useCallback(
    (after: string | null) => {
      if (!term) return;
      const read = ++readRef.current;
      getGlossaryTermExcerpts({
        client: createGraphQLClient(),
        uuid: term.uuid,
        toh,
        first: GLOSSARY_PASSAGES_PAGE_SIZE,
        after,
      }).then((page) => {
        if (read !== readRef.current) return;
        if (!page) {
          setState('error');
          return;
        }
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setTotalCount(page.totalCount);
        setNextCursor(page.hasMore ? page.nextCursor : null);
        setState('idle');
      });
    },
    [term, toh],
  );

  const loadPage = useCallback(
    (after: string | null) => {
      setState('loading');
      load(after);
    },
    [load],
  );

  // A new entry or Toh starts from an empty list, adjusted during render so
  // the old list never shows under the new title.
  const [shown, setShown] = useState<{
    term?: GlossaryPassagesTerm;
    toh?: string;
  }>({});
  if (shown.term !== term || shown.toh !== toh) {
    setShown({ term, toh });
    setItems([]);
    setTotalCount(undefined);
    setNextCursor(null);
    setState(term ? 'loading' : 'idle');
    setTab('passages');
  }

  useEffect(() => {
    if (term) {
      load(null);
    }
    return () => {
      readRef.current++;
    };
  }, [term, load]);

  const jumpTo = useCallback(
    (item: GlossaryPassageExcerpt) => {
      onClose();
      const { panel, tab } = locationForPassageType(item.type);
      updatePanel({
        name: panel,
        state: { open: true, tab, hash: item.uuid },
      });
    },
    [onClose, updatePanel],
  );

  const firstPageFailed = state === 'error' && totalCount === undefined;

  const passages = (
    <div className="overflow-y-auto -mx-2 px-2 min-h-0">
      {totalCount === 0 && (
        <p className="text-sm text-muted-foreground">
          This entry isn&apos;t linked in any passage.
        </p>
      )}
      {firstPageFailed && (
        <p className="text-sm text-muted-foreground">
          The passages couldn&apos;t be loaded.{' '}
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => loadPage(null)}
          >
            Try again
          </Button>
        </p>
      )}
      <ol className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.uuid}>
            <GlossaryPassageExcerptButton
              item={item}
              onClick={() => jumpTo(item)}
            />
          </li>
        ))}
      </ol>
      {state === 'loading' && (
        <p className="text-sm text-muted-foreground py-2">Loading…</p>
      )}
      {state === 'error' && !firstPageFailed && (
        <p className="text-sm text-muted-foreground py-2">
          The next passages couldn&apos;t be loaded.
        </p>
      )}
      {nextCursor && state !== 'loading' && (
        <Button
          variant="link"
          className="px-0"
          onClick={() => loadPage(nextCursor)}
        >
          {state === 'error'
            ? 'Try again'
            : `Show the next ${Math.min(
                GLOSSARY_PASSAGES_PAGE_SIZE,
                (totalCount ?? 0) - items.length,
              ).toLocaleString()} ›`}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={!!term} onOpenChange={(open) => !open && onClose()}>
      {term && (
        <DialogContent
          className={cn(
            'w-full max-h-[85vh] flex flex-col gap-3',
            instances ? 'max-w-4xl' : 'max-w-2xl',
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-primary">
              {term.english || 'Glossary entry'}
              {totalCount !== undefined && (
                <span className="text-muted-foreground font-normal">
                  {' · '}
                  {countLabel(totalCount, 'passage', 'passages')}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              The passages that use this glossary entry.
            </DialogDescription>
          </DialogHeader>

          {instances ? (
            <Tabs
              value={tab}
              onValueChange={(value) =>
                setTab(value === 'instances' ? 'instances' : 'passages')
              }
              className="min-h-0 flex-1"
            >
              <TabsList>
                <TabsTrigger value="passages">Passages</TabsTrigger>
                <TabsTrigger value="instances">Instances</TabsTrigger>
              </TabsList>
              <TabsContent value="passages" className="min-h-0 flex flex-col">
                {passages}
              </TabsContent>
              <TabsContent value="instances" className="min-h-0 flex flex-col">
                <GlossaryInstancesTable
                  key={`${term.uuid}:${toh ?? ''}`}
                  termUuid={term.uuid}
                  onClose={onClose}
                  onRemoved={() => loadPage(null)}
                />
              </TabsContent>
            </Tabs>
          ) : (
            passages
          )}
        </DialogContent>
      )}
    </Dialog>
  );
};

const GlossaryPassageExcerptButton = ({
  item,
  onClick,
}: {
  item: GlossaryPassageExcerpt;
  onClick: () => void;
}) => {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const { start, end } of item.highlights) {
    if (start > at) parts.push(item.text.slice(at, start));
    parts.push(
      <mark key={start} className="bg-highlight text-foreground rounded-sm">
        {item.text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < item.text.length) parts.push(item.text.slice(at));

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-start rounded-md p-2 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
    >
      <span className="flex gap-2 items-baseline text-xs mb-0.5">
        <span className="font-sans font-bold text-primary">
          {item.label || item.uuid.slice(0, 6)}
        </span>
        {item.instanceCount > 1 && (
          <span className="text-muted-foreground">
            {countLabel(item.instanceCount, 'use', 'uses')}
          </span>
        )}
      </span>
      <span className="block text-sm leading-relaxed font-serif">
        {item.truncatedStart && '…'}
        {parts}
        {item.truncatedEnd && '…'}
      </span>
    </button>
  );
};
