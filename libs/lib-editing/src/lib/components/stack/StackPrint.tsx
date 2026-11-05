'use client';

import { Printer } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createGraphQLClient,
  getWorkGlossaryTerms,
} from '@eightyfourthousand/client-graphql';
import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@eightyfourthousand/design-system';

import { useNavigation } from '../shared/NavigationContext';
import { GlossaryInstanceBody } from '../shared/glossary/GlossaryInstanceBody';
import type { StackController } from './StackController';
import { StackRow } from './StackRow';
import { StaticPassageHTML } from './StaticPassage';
import { readStackForPrint, type StackPrintRow } from './stack-print';
import { BIBLIOGRAPHY_TAB } from './stack-seed';
import { useStackWork } from './stack-work-context';

/** The parts printed, in order: the main text, then the back matter. */
const PRINT_TABS = [
  'front',
  'translation',
  'abbreviations',
  'endnotes',
  BIBLIOGRAPHY_TAB,
];

/**
 * Prints the print document alone, and keeps it off screen. Only mounted
 * while there is one, so printing the page otherwise is unchanged.
 */
const PRINT_CSS = `@media print {
  body > *:not([data-stack-print]) { display: none !important; }
  [data-stack-print] button { display: none; }
  [data-stack-print] :is(h1, h2) { break-after: avoid; }
}
@media screen {
  [data-stack-print] { display: none; }
}`;

type PrintPart = { controller: StackController; rows: StackPrintRow[] };
type PrintDocument = { parts: PrintPart[]; glossary: GlossaryTermInstance[] };

type Session =
  | { phase: 'idle' }
  | { phase: 'loading'; loaded: number; total: number }
  | { phase: 'failed' }
  | { phase: 'printing'; document: PrintDocument };

const StackPrintContext = createContext<(() => void) | null>(null);

/**
 * The first of a view's rows on screen, when its run starts part way: growing
 * it upward moves the reader to its old first row, so this is where to return.
 */
const firstRowOnScreen = (controller: StackController): string | null => {
  if (!controller.hasEarlierPassages()) return null;
  const order = new Set(controller.getOrder());
  const rows = document.querySelectorAll<HTMLElement>('[data-stack-passage]');
  for (const row of rows) {
    const uuid = row.dataset['stackPassage'];
    if (!uuid || !order.has(uuid)) continue;
    const { height, top, bottom } = row.getBoundingClientRect();
    if (height && bottom > 0 && top < window.innerHeight) return uuid;
  }
  return null;
};

/** Every glossary term of a work, or null when a page could not be read. */
const readGlossary = async (
  workUuid: string,
  signal: AbortSignal,
): Promise<GlossaryTermInstance[] | null> => {
  const client = createGraphQLClient();
  const terms: GlossaryTermInstance[] = [];
  let cursor: string | undefined;
  do {
    const page = await getWorkGlossaryTerms({
      client,
      uuid: workUuid,
      cursor,
      direction: 'forward',
    });
    if (signal.aborted) return null;
    // A failed read comes back as an empty last page.
    if (cursor && !page.terms.length) return null;
    terms.push(...page.terms);
    cursor = page.hasMoreAfter ? page.nextCursor : undefined;
  } while (cursor);
  return terms;
};

/**
 * Prints a stack reader's whole text: the main text and the back matter, read
 * in full first with progress shown, since its stacks draw only the rows near
 * the viewport.
 *
 * Wraps a layout once; `StackPrintButton`s under it start the one session, as
 * does Cmd/Ctrl+P. Outside a reader's stacks it draws only its children.
 */
export const StackPrint = ({ children }: { children: ReactNode }) => {
  const stack = useStackWork();
  const reader = stack?.readOnly ? stack : null;
  const { uuid, toh, imprint } = useNavigation();
  const [session, setSession] = useState<Session>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Set from a session's start until it is closed, so one runs at a time and
  // a closed one, still awaiting a read, changes nothing.
  const start = useCallback(async () => {
    if (!reader || !uuid || abortRef.current) return;
    const abort = new AbortController();
    abortRef.current = abort;
    const live = () => abortRef.current === abort && !abort.signal.aborted;
    const controllers = PRINT_TABS.flatMap(
      (tab) => reader.controllerFor(tab) ?? [],
    );
    // Rows read and known per part, summed for one bar.
    const progress = controllers.map(() => ({ loaded: 0, total: 0 }));
    const show = () =>
      live() &&
      setSession({
        phase: 'loading',
        loaded: progress.reduce((sum, part) => sum + part.loaded, 0),
        total: progress.reduce((sum, part) => sum + part.total, 0),
      });
    show();

    try {
      const parts: PrintPart[] = [];
      for (const [i, controller] of controllers.entries()) {
        // As its stack would be, were it on screen.
        controller.setActiveToh(toh);
        const anchor = firstRowOnScreen(controller);
        const rows = await readStackForPrint(controller, {
          signal: abort.signal,
          onProgress: (part) => {
            progress[i] = part;
            show();
          },
        }).finally(() => {
          if (anchor && mountedRef.current)
            void controller.revealPassage(anchor);
        });
        if (!live()) return;
        if (!rows) return setSession({ phase: 'failed' });
        parts.push({ controller, rows });
      }
      const glossary = await readGlossary(uuid, abort.signal);
      if (!live()) return;
      if (!glossary) return setSession({ phase: 'failed' });
      setSession({ phase: 'printing', document: { parts, glossary } });
    } catch (error) {
      console.error('could not read the work for printing', error);
      if (live()) setSession({ phase: 'failed' });
    }
  }, [reader, uuid, toh]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSession({ phase: 'idle' });
  }, []);

  const print = useCallback(() => void start(), [start]);

  // A reader leaving mid-load stops the reads.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // The browser's own shortcut would print the few rows on screen.
  useEffect(() => {
    if (!reader) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'p') return;
      event.preventDefault();
      print();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reader, print]);

  // Committed with the print document, so it is in the page when printed.
  const printing = session.phase === 'printing';
  useEffect(() => {
    if (!printing) return;
    window.addEventListener('afterprint', close);
    window.print();
    return () => window.removeEventListener('afterprint', close);
  }, [printing, close]);

  if (!reader) return children;

  const loading = session.phase === 'loading' ? session : null;
  const description = {
    idle: '',
    loading: `Loading the whole text: ${loading?.loaded.toLocaleString()} of ${loading?.total.toLocaleString()} passages.`,
    failed: 'The whole text could not load, so it was not printed.',
    printing: 'Sent to the print dialog.',
  }[session.phase];
  return (
    <StackPrintContext.Provider value={print}>
      {children}
      <Dialog
        // Open until the print dialog closes, which some browsers don't wait for.
        open={session.phase !== 'idle'}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          <DialogTitle>Preparing to print</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {loading && (
            <div
              role="progressbar"
              aria-label="Loading the whole text"
              aria-valuemin={0}
              aria-valuemax={loading.total}
              aria-valuenow={loading.loaded}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary transition-[width]"
                style={{
                  width: `${loading.total ? (100 * loading.loaded) / loading.total : 0}%`,
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {loading ? 'Cancel' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {session.phase === 'printing' &&
        createPortal(
          <PrintDocumentView
            document={session.document}
            title={imprint?.mainTitles?.en}
          />,
          document.body,
        )}
    </StackPrintContext.Provider>
  );
};

/** The whole text, laid out in flow for printing. */
const PrintDocumentView = ({
  document,
  title,
}: {
  document: PrintDocument;
  title?: string;
}) => (
  <div data-stack-print="" className="w-full max-w-readable mx-auto">
    <style>{PRINT_CSS}</style>
    {title && <h1 className="mb-8 text-3xl">{title}</h1>}
    {document.parts.map(({ controller, rows }) => (
      <section key={controller.getTab()} className="mb-12">
        {rows.map(({ meta, html }) => {
          const look = controller.rowStyle(meta);
          return (
            <div key={meta.uuid} className="flow-root w-full">
              <StackRow
                uuid={meta.uuid}
                label={meta.label}
                className={look.className}
                contentStyle={look.style}
              >
                <StaticPassageHTML html={html} />
              </StackRow>
            </div>
          );
        })}
      </section>
    ))}
    {document.glossary.length > 0 && (
      <section>
        <h2 className="mb-6 text-2xl">Glossary</h2>
        <div className="flex flex-col gap-6">
          {document.glossary.map((instance) => (
            <StackRow
              key={instance.uuid}
              uuid={instance.uuid}
              label={`g.${instance.termNumber}`}
            >
              <GlossaryInstanceBody instance={instance} />
            </StackRow>
          ))}
        </div>
      </section>
    )}
  </div>
);

/** Starts printing the whole text. Draws nothing outside a stack reader. */
export const StackPrintButton = () => {
  const print = useContext(StackPrintContext);
  if (!print) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="cursor-pointer [&_svg]:size-5 md:[&_svg]:size-7 size-6 md:size-9 [&_svg]:stroke-1 text-accent hover:text-accent hover:bg-muted"
      onClick={print}
    >
      <Printer />
      <span className="sr-only">Print</span>
    </Button>
  );
};
