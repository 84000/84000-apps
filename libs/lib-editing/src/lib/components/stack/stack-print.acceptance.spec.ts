/**
 * Acceptance tests for DEV-837 item 5, AC1.1 to AC1.7: `readStackForPrint`,
 * which reads a whole run of a read-only stack view for printing.
 *
 * Written from the spec, not the implementation. Only the network is faked: a
 * `RowFeed` over fake `RowPages` that read forward, BACKWARD and AROUND, and a
 * `PassageLoader` (buffer 0) over a counting `PassageSource`. A run opened part
 * way is a fresh feed whose first call is `reveal(uuid)`, as a deep link does.
 */
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { StackController } from './StackController';
import { readStackForPrint, type StackPrintProgress } from './stack-print';
import {
  readerBibliographyWork,
  type ReaderBibliographyWork,
} from './bibliography-work';
import { createStackWorkDocument } from './stack-work';
import { seeds, source } from './stack-controller.fixture';
import {
  RowFeed,
  type RowMeta,
  type RowMetaPage,
  type RowPages,
} from './spine-feed';
import type { BibliographyEntries } from '@eightyfourthousand/data-access';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const TAB = 'translation';

type Reads = {
  /** Calls to the pages' `metas`, by direction. */
  metas: number;
  /** Calls to the source's `loadPassages`. */
  loads: number;
  /** Runs once per `loadPassages` call, before it answers. */
  onLoad?: () => void;
  /** Runs once per `metas` call, before it answers. */
  onMetas?: () => void;
};

/** Fake pages over `metas`, which read the way the API's cursors do. */
const pagesOver = (metas: RowMeta[], reads: Reads): RowPages => ({
  metas: async ({ cursor, limit, direction }) => {
    reads.metas += 1;
    reads.onMetas?.();
    const at = cursor ? metas.findIndex((m) => m.uuid === cursor) : -1;
    let start: number;
    let end: number;
    if (direction === 'BACKWARD') {
      end = cursor ? at : metas.length;
      start = Math.max(0, end - limit);
    } else if (direction === 'AROUND') {
      start = Math.max(0, at - Math.floor(limit / 2));
      end = Math.min(metas.length, start + limit);
    } else {
      start = at + 1;
      end = Math.min(metas.length, start + limit);
    }
    const page = metas.slice(start, end);
    const result: RowMetaPage = {
      metas: page,
      prevCursor: page[0]?.uuid,
      nextCursor: page[page.length - 1]?.uuid,
      hasMoreBefore: start > 0,
      hasMoreAfter: end < metas.length,
    };
    return result;
  },
  content: async () => null,
});

type OpenOptions = {
  count: number;
  /** Open the run part way, with a `reveal` of this uuid, rather than at its top. */
  revealAt?: string;
  /** Scope some rows to a Toh, by index. */
  tohOf?: (index: number) => string | undefined;
  /** Uuids the source returns nothing for. */
  missing?: string[];
};

/** A controller over a windowed run of `count` passages, opened as asked. */
const open = async ({ count, revealAt, tohOf, missing = [] }: OpenOptions) => {
  const all = seeds(count);
  const metas: RowMeta[] = all.map((entry, i) => ({
    ...entry.meta,
    sort: i + 1,
    ...(tohOf?.(i) ? { toh: tohOf(i) } : {}),
  }));
  const reads: Reads = { metas: 0, loads: 0 };
  const served = source(all.filter((e) => !missing.includes(e.meta.uuid)));
  const counted = {
    name: 'counted',
    loadPassages: (workUuid: string, uuids: string[]) => {
      reads.loads += 1;
      reads.onLoad?.();
      return served.loadPassages(workUuid, uuids);
    },
  };
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [counted], buffer: 0 }),
  });
  const feed = new RowFeed(work, pagesOver(metas, reads), TAB);
  if (revealAt) await feed.reveal(revealAt);
  else await feed.seed();
  const controller = new StackController({
    work,
    tab: TAB,
    spineFeed: feed,
  });
  const reveal = jest.spyOn(feed, 'reveal');
  const revealStart = jest.spyOn(feed, 'revealStart');
  return { all, metas, work, feed, controller, reads, reveal, revealStart };
};

const uuids = (count: number) =>
  Array.from({ length: count }, (_, i) => `p${i}`);

describe('readStackForPrint', () => {
  describe('AC1.1: every row of the run, in the controller’s order', () => {
    it('AC1.1 carries each row’s meta and the static HTML getStaticHTML gives a hydrated row', async () => {
      const { controller, all } = await open({ count: 120 });

      const rows = await readStackForPrint(controller);

      // The same rows, hydrated the ordinary way in a work of their own.
      const reference = createStackWorkDocument({
        workUuid: 'work-1',
        loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
      });
      reference.seedSpine(all.map((entry) => entry.meta));
      const view = new StackController({ work: reference });
      await reference.store.hydrateMany(all.map((entry) => entry.meta.uuid));

      expect(rows).toHaveLength(120);
      rows?.forEach((row, i) => {
        expect(row.meta).toEqual(controller.getMeta(`p${i}`));
        expect(row.meta.uuid).toBe(`p${i}`);
        expect(row.html).toBe(view.getStaticHTML(`p${i}`));
        expect(row.html).toContain(`passage ${i} text`);
      });
    });

    it('AC1.1 leaves out the rows the active Toh hides', async () => {
      const tohOf = (i: number) =>
        i % 3 === 0 ? 'toh145' : i % 3 === 1 ? 'toh847' : undefined;
      const { controller } = await open({ count: 250, tohOf });
      controller.setActiveToh('toh145');

      const rows = await readStackForPrint(controller);

      const expected = uuids(250).filter((_, i) => tohOf(i) !== 'toh847');
      expect(rows?.map((row) => row.meta.uuid)).toEqual(expected);
      expect(controller.getOrder()).toEqual(expected);
      expect(rows?.some((row) => row.meta.uuid === 'p1')).toBe(false);
    });
  });

  describe('AC1.4: progress', () => {
    it('AC1.4 reports at least once for a run held entirely already', async () => {
      const { controller } = await open({ count: 30 });
      const calls: StackPrintProgress[] = [];

      const rows = await readStackForPrint(controller, {
        onProgress: (progress) => calls.push({ ...progress }),
      });

      expect(rows).toHaveLength(30);
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[calls.length - 1]).toEqual({ loaded: 30, total: 30 });
    });
  });

  describe('AC1.5: cancelling', () => {
    it('AC1.5 resolves to null and starts no further page reads once an abort during a page read is seen', async () => {
      const { controller, reads } = await open({ count: 1000 });
      const abort = new AbortController();
      const seen: { atAbort?: { metas: number; loads: number } } = {};
      reads.onMetas = () => {
        if (seen.atAbort) return;
        abort.abort();
        seen.atAbort = { metas: reads.metas, loads: reads.loads };
      };

      const rows = await readStackForPrint(controller, {
        signal: abort.signal,
      });

      expect(seen.atAbort).toBeDefined();
      expect(rows).toBeNull();
      expect(reads.metas).toBe(seen.atAbort?.metas);
      expect(reads.loads).toBe(seen.atAbort?.loads);
    });

    it('AC1.5 resolves to null and starts no further document reads once an abort during a document read is seen', async () => {
      // Fully grown first, so what remains to read is documents alone.
      const { controller, reads, feed } = await open({ count: 1000 });
      while (feed.hasMore) await feed.extend();
      const abort = new AbortController();
      const seen: { atAbort?: { metas: number; loads: number } } = {};
      reads.onLoad = () => {
        if (seen.atAbort) return;
        abort.abort();
        seen.atAbort = { metas: reads.metas, loads: reads.loads };
      };

      const rows = await readStackForPrint(controller, {
        signal: abort.signal,
      });

      expect(seen.atAbort).toBeDefined();
      expect(rows).toBeNull();
      expect(reads.metas).toBe(seen.atAbort?.metas);
      expect(reads.loads).toBe(seen.atAbort?.loads);
    });
  });

  describe('AC1.7: rows that carry given static HTML', () => {
    const entries = [
      {
        heading: 'Tibetan Texts',
        label: '1',
        entries: [
          {
            uuid: 'e-1-1',
            label: '1.1',
            html: '<p><em>Kangyur</em> source alpha</p>',
          },
          { uuid: 'e-1-2', label: '1.2', html: '<p>Kangyur source beta</p>' },
        ],
      },
      {
        heading: 'Secondary Sources',
        label: '2',
        entries: [
          { uuid: 'e-2-1', label: '2.1', html: '<p>Secondary gamma</p>' },
        ],
      },
    ] as unknown as BibliographyEntries;

    /** The view the reader's provider builds for a seeded bibliography. */
    const bibliographyView = (): {
      bibliography: ReaderBibliographyWork;
      view: StackController;
    } => {
      const bibliography = readerBibliographyWork({
        workUuid: 'work-1',
        entries,
        graphql: {} as never,
      });
      if (!bibliography) throw new Error('no bibliography rows');
      const view = new StackController({
        work: bibliography.work,
        tab: 'bibliography',
        rows: 'bibliography',
        staticHTML: bibliography.html,
        readOnly: true,
      });
      return { bibliography, view };
    };

    it('AC1.7 resolves to those rows with the given HTML, in order', async () => {
      const { bibliography, view } = bibliographyView();

      const rows = await readStackForPrint(view);

      expect(rows).not.toBeNull();
      expect(rows?.map((row) => row.meta.uuid)).toEqual(view.getOrder());
      expect(rows).toHaveLength(5) /* 2 headings and 3 entries */;
      rows?.forEach((row) =>
        expect(row.html).toBe(bibliography.html.get(row.meta.uuid)),
      );
      expect(rows?.map((row) => row.html).join('')).toContain(
        '<p><em>Kangyur</em> source alpha</p>',
      );
    });

    it('AC1.7 loads no documents for them', async () => {
      const { bibliography, view } = bibliographyView();
      expect(bibliography.work.store.size).toBe(0);

      await readStackForPrint(view);

      expect(bibliography.work.store.size).toBe(0);
    });
  });
});
