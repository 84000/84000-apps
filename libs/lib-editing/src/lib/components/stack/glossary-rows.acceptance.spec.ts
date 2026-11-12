/**
 * Acceptance tests for DEV-883 rows criteria 1 and 3, and definition criteria
 * 4 and 5 as they show in a loaded glossary: `loadGlossaryWork` reads a page of
 * rows, and `hydrateWindow` turns the rows in view into editable documents.
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation. Only
 * data-access is faked, at the module boundary.
 */
import type { JSONContent } from '@tiptap/core';

import { glossaryContentToDefinition } from './glossary-codec';
import { GLOSSARY_SEED_DEFINITIONS } from './glossary-seed.fixture';
import { loadGlossaryWork, type GlossaryWork } from './glossary-work';
import {
  glossaryFake,
  nameOf,
  numberedItems,
  plainText,
  WORK,
  type GlossaryFake,
  type GlossaryItem,
  type PageArgs,
} from './glossary-work.fixture';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

let fake: GlossaryFake;
const mockPage = (args: PageArgs) => fake.page(args);
const mockEntries = (args: { workUuid: string; uuids: readonly string[] }) =>
  fake.entries(args);

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: PageArgs) => mockPage(args),
  getGlossaryEntries: (args: { workUuid: string; uuids: readonly string[] }) =>
    mockEntries(args),
  createBrowserClient: () => ({}),
}));

const load = async (items: GlossaryItem[]): Promise<GlossaryWork> => {
  fake = glossaryFake(items);
  const glossary = await loadGlossaryWork({
    workUuid: WORK,
    client: fake.client,
    graphql: {} as never,
  });
  if (!glossary) throw new Error('the glossary did not load');
  return glossary;
};

const rowsOf = (glossary: GlossaryWork) => glossary.work.spine.entries();
const textOf = (glossary: GlossaryWork, uuid: string) =>
  glossary.work.store.peek(uuid)?.toNode().textContent;

/** Read pages until the feed has no more, or `limit` pages. */
const readAll = async (glossary: GlossaryWork, limit = 50) => {
  for (let i = 0; i < limit && glossary.feed.hasMore; i++) {
    await glossary.feed.extend?.();
  }
};

describe('criterion 1: one row per entry, in glossary order, labelled as the reader does', () => {
  it('criterion 1: lists a row per entry in glossary order, not uuid order', async () => {
    const glossary = await load([
      { uuid: 'z-first', termNumber: 1, definition: '<p>one</p>' },
      { uuid: 'a-second', termNumber: 2, definition: '<p>two</p>' },
      { uuid: 'm-third', termNumber: 3, definition: '<p>three</p>' },
    ]);

    expect(rowsOf(glossary).map((row) => row.uuid)).toEqual([
      'z-first',
      'a-second',
      'm-third',
    ]);
  });

  it('criterion 1: labels each row g.<termNumber>, as glossary rows of type glossary', async () => {
    const glossary = await load([
      { uuid: 'x', termNumber: 1, definition: null },
      { uuid: 'y', termNumber: 2, definition: null },
      // A gap in the numbering: the label is the term's number, not its place.
      { uuid: 'z', termNumber: 5, definition: null },
    ]);

    expect(
      rowsOf(glossary).map(({ uuid, label, type }) => ({ uuid, label, type })),
    ).toEqual([
      { uuid: 'x', label: 'g.1', type: 'glossary' },
      { uuid: 'y', label: 'g.2', type: 'glossary' },
      { uuid: 'z', label: 'g.5', type: 'glossary' },
    ]);
  });

  it('criterion 1: gives the rows ascending sorts', async () => {
    const glossary = await load(numberedItems(8));
    const sorts = rowsOf(glossary).map((row) => row.sort);

    expect(sorts.every((sort) => typeof sort === 'number')).toBe(true);
    expect(sorts).toEqual([...sorts].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(new Set(sorts).size).toBe(sorts.length);
  });

  it('criterion 1: reads on page by page, keeping order and every entry once', async () => {
    const glossary = await load(numberedItems(430));
    const first = rowsOf(glossary).length;
    expect(first).toBeLessThan(430);
    expect(glossary.feed.hasMore).toBe(true);
    const lastOfFirst = rowsOf(glossary)[first - 1].uuid;

    await glossary.feed.extend?.();

    // The next page starts after the last row read.
    expect(fake.page).toHaveBeenCalledTimes(2);
    expect(fake.page.mock.calls[1][0].cursor).toBe(lastOfFirst);
    expect(rowsOf(glossary).length).toBeGreaterThan(first);

    await readAll(glossary);

    expect(glossary.feed.hasMore).toBe(false);
    expect(rowsOf(glossary).map((row) => row.uuid)).toEqual(
      numberedItems(430).map((item) => item.uuid),
    );
    expect(rowsOf(glossary).map((row) => row.label)).toEqual(
      numberedItems(430).map((item) => `g.${item.termNumber}`),
    );
  });
});

describe('criterion 3: a large work opens without building every row’s editor', () => {
  const LARGEST = 9342;

  it('criterion 3: opening the largest work reads one page of rows, not all 9,342', async () => {
    const glossary = await load(numberedItems(LARGEST));

    expect(fake.page).toHaveBeenCalledTimes(1);
    const loaded = rowsOf(glossary).length;
    expect(loaded).toBeGreaterThan(0);
    expect(loaded).toBeLessThanOrEqual(200);
    expect(glossary.feed.hasMore).toBe(true);
    // No document for any row until a window is hydrated, or only a few.
    expect(glossary.work.store.held().length).toBeLessThanOrEqual(loaded);
  });

  it('criterion 3: hydrating a window reads and builds only the rows near it', async () => {
    const glossary = await load(numberedItems(LARGEST));
    // Enough rows loaded that the window is a small part of them.
    for (let i = 0; i < 20 && rowsOf(glossary).length < 300; i++) {
      await glossary.feed.extend?.();
    }
    const loaded = rowsOf(glossary);
    expect(loaded.length).toBeGreaterThanOrEqual(300);

    await glossary.work.hydrateWindow({ start: 0, end: 10 });

    const held = glossary.work.store.held();
    const spine = new Set(loaded.map((row) => row.uuid));
    expect(held.length).toBeGreaterThanOrEqual(10);
    expect(held.length).toBeLessThanOrEqual(100);
    expect(held.length).toBeLessThan(loaded.length);
    expect(held.every((uuid) => spine.has(uuid))).toBe(true);
    // Every row of the window has its document; one far away has none.
    loaded
      .slice(0, 10)
      .forEach((row) =>
        expect(glossary.work.store.peek(row.uuid)).not.toBeUndefined(),
      );
    expect(
      glossary.work.store.peek(loaded[loaded.length - 1].uuid),
    ).toBeUndefined();
    // Entries were read for those rows alone.
    const asked = new Set(
      fake.entries.mock.calls.flatMap((call) => call[0].uuids),
    );
    expect(asked.size).toBeLessThanOrEqual(100);
    expect(asked.size).toBeLessThan(loaded.length);
    expect([...asked].every((uuid) => spine.has(uuid))).toBe(true);
  });

  it('criterion 3: moving the window builds the new rows and lets the old go', async () => {
    const glossary = await load(numberedItems(LARGEST));
    for (let i = 0; i < 20 && rowsOf(glossary).length < 400; i++) {
      await glossary.feed.extend?.();
    }
    const loaded = rowsOf(glossary);
    expect(loaded.length).toBeGreaterThanOrEqual(400);

    await glossary.work.hydrateWindow({ start: 0, end: 10 });
    await glossary.work.hydrateWindow({ start: 300, end: 310 });

    expect(glossary.work.store.peek(loaded[0].uuid)).toBeUndefined();
    expect(glossary.work.store.peek(loaded[305].uuid)).not.toBeUndefined();
    expect(glossary.work.store.held().length).toBeLessThanOrEqual(100);
  });
});

describe('criterion 4: the definition is the row’s text', () => {
  it('criterion 4: a hydrated row holds its definition, and not its names', async () => {
    const glossary = await load([
      {
        uuid: 'g1',
        termNumber: 1,
        definition: '<p>The teacher or <em>guide</em> upon the path.</p>',
        english: 'spiritual friend',
        names: [
          nameOf('g1', 'en', 'spiritual friend'),
          nameOf('g1', 'Sa-Ltn', 'kalyāṇamitra'),
        ],
      },
    ]);

    await glossary.work.hydrateWindow({ start: 0, end: 1 });

    expect(textOf(glossary, 'g1')).toBe('The teacher or guide upon the path.');
  });

  it('criterion 4: a row with no definition is an empty row, still editable', async () => {
    const glossary = await load([
      { uuid: 'g1', termNumber: 1, definition: null },
    ]);

    await glossary.work.hydrateWindow({ start: 0, end: 1 });

    const doc = glossary.work.store.peek('g1');
    expect(doc).not.toBeUndefined();
    expect(doc?.toNode().textContent).toBe('');
  });

  it('criterion 4: carries the same inline marks as bibliography rows', async () => {
    const glossary = await load([
      {
        uuid: 'g1',
        termNumber: 1,
        definition:
          '<p>An <em>italic</em>, a <strong>bold</strong> and a <a href="https://example.org/a">link</a>.</p>',
      },
    ]);

    await glossary.work.hydrateWindow({ start: 0, end: 1 });

    const marks = new Set<string>();
    const walk = (node: JSONContent) => {
      node.marks?.forEach((mark) => marks.add(mark.type as string));
      node.content?.forEach(walk);
    };
    walk(glossary.work.store.peek('g1')?.toJSON() ?? {});
    expect(marks).toEqual(new Set(['italic', 'bold', 'link']));
  });

  it('criterion 4: an edit is held in the row document, and marks the row edited', async () => {
    const glossary = await load([
      { uuid: 'g1', termNumber: 1, definition: '<p>Before.</p>' },
    ]);
    await glossary.work.hydrateWindow({ start: 0, end: 1 });
    const doc = glossary.work.store.peek('g1');

    doc?.replaceContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
      ],
    });
    doc?.markDirty();

    expect(textOf(glossary, 'g1')).toBe('After.');
    expect(doc?.isDirty).toBe(true);
  });
});

describe('criterion 5: every seed definition loads and can be written back unchanged', () => {
  it.each(GLOSSARY_SEED_DEFINITIONS.map(([name, html]) => [name, html]))(
    'criterion 5: the seed definition (%s) loads into a row and writes back as it was',
    async (_name, html) => {
      const glossary = await load([
        { uuid: 'g1', termNumber: 1, definition: html },
      ]);
      await glossary.work.hydrateWindow({ start: 0, end: 1 });

      const doc = glossary.work.store.peek('g1');
      expect(doc?.isDirty).toBe(false);
      expect(plainText(html)).toBe(doc?.toNode().textContent);
      expect(glossaryContentToDefinition(doc?.toJSON().content ?? [])).toBe(
        html,
      );
    },
  );

  it('criterion 5: loading rows leaves none of them edited', async () => {
    const glossary = await load(
      GLOSSARY_SEED_DEFINITIONS.map(([, html], i) => ({
        uuid: `g${i + 1}`,
        termNumber: i + 1,
        definition: html,
      })),
    );

    await glossary.work.hydrateWindow({ start: 0, end: 100 });

    const docs = glossary.work.store
      .held()
      .map((uuid) => glossary.work.store.peek(uuid));
    expect(docs).toHaveLength(GLOSSARY_SEED_DEFINITIONS.length);
    expect(docs.every((doc) => doc && !doc.isDirty)).toBe(true);
  });
});
