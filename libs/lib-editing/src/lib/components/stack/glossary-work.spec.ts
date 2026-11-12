import type {
  DataClient,
  GlossaryEntry,
  GlossaryTermNode,
} from '@eightyfourthousand/data-access';

import {
  glossaryPages,
  loadGlossaryWork,
  renderGlossaryRow,
} from './glossary-work';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockPage = jest.fn();
const mockEntries = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: unknown) => mockPage(args),
  getGlossaryEntries: (args: unknown) => mockEntries(args),
}));

const WORK = 'w1';
const client = {} as DataClient;

const node = (uuid: string, termNumber: number): GlossaryTermNode =>
  ({
    uuid,
    authority: `a-${uuid}`,
    termNumber,
    definition: `<p>${uuid} defined</p>`,
    names: { english: uuid },
  }) as GlossaryTermNode;

const entry = (uuid: string, definition = `<p>${uuid} defined</p>`) =>
  ({
    uuid,
    workUuid: WORK,
    authorityUuid: `a-${uuid}`,
    definition,
    definitionRend: null,
    glossMode: 'match',
    names: [],
  }) as GlossaryEntry;

const page = (
  nodes: GlossaryTermNode[],
  pageInfo: Partial<{
    nextCursor: string;
    prevCursor: string;
    hasMoreAfter: boolean;
    hasMoreBefore: boolean;
  }> = {},
) => ({
  nodes,
  pageInfo: {
    nextCursor: null,
    prevCursor: null,
    hasMoreAfter: false,
    hasMoreBefore: false,
    ...pageInfo,
  },
  totalCount: nodes.length,
});

beforeEach(() => {
  mockPage.mockReset();
  mockEntries.mockReset();
});

describe('glossaryPages', () => {
  it('reads draft rows labelled and ordered as the readers number them', async () => {
    mockPage.mockResolvedValue(
      page([node('t1', 1), node('t2', 2)], {
        nextCursor: 't2',
        hasMoreAfter: true,
      }),
    );
    const result = await glossaryPages({ client, workUuid: WORK }).metas({
      limit: 500,
    });
    expect(mockPage).toHaveBeenCalledWith(
      expect.objectContaining({
        workUuid: WORK,
        direction: 'FORWARD',
        limit: 200,
        source: 'draft',
      }),
    );
    expect(result.metas).toEqual([
      expect.objectContaining({
        uuid: 't1',
        label: 'g.1',
        type: 'glossary',
        sort: 1,
      }),
      expect.objectContaining({ uuid: 't2', label: 'g.2', sort: 2 }),
    ]);
    expect(result.nextCursor).toBe('t2');
    expect(result.hasMoreAfter).toBe(true);
    expect(result.prevCursor).toBeUndefined();
  });

  it('passes a cursor and direction through', async () => {
    mockPage.mockResolvedValue(page([]));
    await glossaryPages({ client, workUuid: WORK }).metas({
      cursor: 't5',
      direction: 'AROUND',
      limit: 20,
    });
    expect(mockPage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 't5', direction: 'AROUND', limit: 20 }),
    );
  });

  it('estimates a longer row for a longer definition', async () => {
    mockPage.mockResolvedValue(
      page([
        node('short', 1),
        { ...node('long', 2), definition: `<p>${'x'.repeat(2000)}</p>` },
      ]),
    );
    const { metas } = await glossaryPages({ client, workUuid: WORK }).metas({
      limit: 10,
    });
    const [short, long] = metas.map((meta) => meta.contentLength ?? 0);
    expect(long).toBeGreaterThan(short + 1900);
  });
});

describe('loadGlossaryWork', () => {
  it('reads the first page into the spine, and no entries', async () => {
    mockPage.mockResolvedValue(page([node('t1', 1), node('t2', 2)]));
    const glossary = await loadGlossaryWork({
      workUuid: WORK,
      client,
      graphql: {} as never,
    });
    expect(glossary?.work.spine.entries().map((e) => e.uuid)).toEqual([
      't1',
      't2',
    ]);
    expect(glossary?.work.spine.meta('t1')?.label).toBe('g.1');
    expect(mockEntries).not.toHaveBeenCalled();
    glossary?.work.destroy();
  });

  it('reads an entry with its row document', async () => {
    mockPage.mockResolvedValue(page([node('t1', 1), node('t2', 2)]));
    mockEntries.mockImplementation(async ({ uuids }: { uuids: string[] }) =>
      uuids.map((uuid) => entry(uuid)),
    );
    const glossary = await loadGlossaryWork({
      workUuid: WORK,
      client,
      graphql: {} as never,
    });
    if (!glossary) throw new Error('not loaded');
    await glossary.work.hydrateWindow({ start: 0, end: 2 });
    expect(mockEntries).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: WORK, uuids: ['t1', 't2'] }),
    );
    expect(glossary.entries.get('t1')?.definition).toBe('<p>t1 defined</p>');
    expect(glossary.work.store.has('t1')).toBe(true);
    expect(renderGlossaryRow(glossary.work.store.ensure('t1').toJSON())).toBe(
      '<p>t1 defined</p>',
    );
    glossary.work.destroy();
  });

  it('opens the largest glossary a page at a time, reading entries only for a window', async () => {
    const nodes = Array.from({ length: 9342 }, (_, i) =>
      node(`t${i + 1}`, i + 1),
    );
    mockPage.mockImplementation(
      async ({ cursor, limit }: { cursor?: string; limit: number }) => {
        const start = cursor
          ? nodes.findIndex((n) => n.uuid === cursor) + 1
          : 0;
        const slice = nodes.slice(start, start + limit);
        const more = start + limit < nodes.length;
        return page(slice, {
          ...(more ? { nextCursor: slice[slice.length - 1].uuid } : {}),
          hasMoreAfter: more,
        });
      },
    );
    mockEntries.mockImplementation(async ({ uuids }: { uuids: string[] }) =>
      uuids.map((uuid) => entry(uuid)),
    );
    const glossary = await loadGlossaryWork({
      workUuid: WORK,
      client,
      graphql: {} as never,
    });
    if (!glossary) throw new Error('not loaded');
    expect(mockPage).toHaveBeenCalledTimes(1);
    expect(glossary.feed.hasMore).toBe(true);
    expect(glossary.work.spine.entries().length).toBeLessThanOrEqual(200);

    for (
      let tries = 0;
      tries < 20 && glossary.work.spine.entries().length < 300;
      tries++
    ) {
      await glossary.feed.extend?.();
    }
    expect(glossary.work.spine.entries().length).toBeGreaterThanOrEqual(300);
    const rows = glossary.work.spine.entries().map((row) => row.uuid);
    await glossary.work.hydrateWindow({ start: 0, end: 10 });

    const asked = new Set(
      mockEntries.mock.calls.flatMap(([{ uuids }]) => uuids as string[]),
    );
    rows.slice(0, 10).forEach((uuid) => {
      expect(asked).toContain(uuid);
      expect(glossary.work.store.peek(uuid)).not.toBeNull();
    });
    expect(asked.size).toBeLessThanOrEqual(100);
    [...asked].forEach((uuid) => expect(rows).toContain(uuid));
    const held = glossary.work.store.held();
    expect(held.length).toBeGreaterThanOrEqual(10);
    expect(held.length).toBeLessThanOrEqual(100);
    held.forEach((uuid) => expect(rows).toContain(uuid));
    expect(glossary.work.store.peek(rows[rows.length - 1])).toBeNull();
    glossary.work.destroy();
  });

  it('is null for a work without entries', async () => {
    mockPage.mockResolvedValue(page([]));
    expect(
      await loadGlossaryWork({ workUuid: WORK, client, graphql: {} as never }),
    ).toBeNull();
  });

  it('is null when the glossary cannot be read', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockPage.mockRejectedValue(new Error('offline'));
    expect(
      await loadGlossaryWork({ workUuid: WORK, client, graphql: {} as never }),
    ).toBeNull();
    error.mockRestore();
  });
});
