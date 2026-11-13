import type {
  DataClient,
  GlossaryEntry,
  GlossaryTermNode,
} from '@eightyfourthousand/data-access';

import { copyGlossaryRow, placeGlossaryRow } from './glossary-copy';
import { loadGlossaryWork, type GlossaryWork } from './glossary-work';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockPage = jest.fn();
const mockEntries = jest.fn();
const mockCopy = jest.fn();
const mockRead = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: unknown) => mockPage(args),
  getGlossaryEntries: (args: unknown) => mockEntries(args),
  copyGlossaryEntry: (args: unknown) => mockCopy(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
}));

const WORK = 'w1';
const client = {} as DataClient;

const entry = (uuid: string, workUuid = WORK): GlossaryEntry => ({
  uuid,
  workUuid,
  authorityUuid: `a-${uuid}`,
  definition: `<p>${uuid} defined.</p>`,
  definitionRend: null,
  glossMode: 'match',
  names: [],
});

const node = (uuid: string, termNumber: number) =>
  ({
    uuid,
    authority: `a-${uuid}`,
    termNumber,
    definition: `<p>${uuid} defined.</p>`,
    names: { english: uuid },
  }) as GlossaryTermNode;

const page = (nodes: GlossaryTermNode[], more = { after: false }) => ({
  nodes,
  pageInfo: {
    nextCursor: nodes.at(-1)?.uuid ?? null,
    prevCursor: null,
    hasMoreAfter: more.after,
    hasMoreBefore: false,
  },
  totalCount: 9,
});

/** A glossary whose first page holds t1, t2, t3. */
const loaded = async (more = { after: false }) => {
  mockPage.mockResolvedValueOnce(
    page([node('t1', 1), node('t2', 2), node('t3', 3)], more),
  );
  mockEntries.mockImplementation(async ({ uuids }: { uuids: string[] }) =>
    uuids.map((uuid) => entry(uuid)),
  );
  return (await loadGlossaryWork({
    workUuid: WORK,
    client,
    graphql: {} as never,
  })) as GlossaryWork;
};

const rows = (glossary: GlossaryWork) =>
  glossary.work.spine.entries().map(({ uuid, label }) => `${label} ${uuid}`);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('placeGlossaryRow', () => {
  it('puts the row between its neighbours and renumbers the rows after it', async () => {
    const glossary = await loaded();
    mockPage.mockResolvedValueOnce(
      page([node('t1', 1), node('c', 2), node('t2', 3)]),
    );

    expect(await placeGlossaryRow({ glossary, uuid: 'c', client })).toBe(true);

    expect(mockPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workUuid: WORK,
        cursor: 'c',
        direction: 'AROUND',
        source: 'draft',
      }),
    );
    expect(rows(glossary)).toEqual(['g.1 t1', 'g.2 c', 'g.3 t2', 'g.4 t3']);
    expect(glossary.work.spine.meta('c')).toMatchObject({
      type: 'glossary',
      sort: 2,
    });
  });

  it('puts a row that sorts first before the first row', async () => {
    const glossary = await loaded();
    mockPage.mockResolvedValueOnce(page([node('c', 1), node('t1', 2)]));

    await placeGlossaryRow({ glossary, uuid: 'c', client });

    expect(rows(glossary)).toEqual(['g.1 c', 'g.2 t1', 'g.3 t2', 'g.4 t3']);
  });

  it('puts a row that sorts last after the last row', async () => {
    const glossary = await loaded();
    mockPage.mockResolvedValueOnce(page([node('t3', 3), node('c', 4)]));

    await placeGlossaryRow({ glossary, uuid: 'c', client });

    expect(rows(glossary).at(-1)).toBe('g.4 c');
  });

  it('leaves a row outside the window for the feed', async () => {
    const glossary = await loaded({ after: true });
    mockPage.mockResolvedValueOnce(
      page([node('t7', 7), node('c', 8), node('t8', 9)]),
    );

    expect(await placeGlossaryRow({ glossary, uuid: 'c', client })).toBe(false);

    expect(rows(glossary)).toEqual(['g.1 t1', 'g.2 t2', 'g.3 t3']);
  });
});

describe('copyGlossaryRow', () => {
  const source = entry('s1', 'other-work');

  it('copies the entry into this work and places its row', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: true,
      dryRun: false,
      entries: [entry('c')],
      deleted: [],
      changes: {},
    });
    mockPage.mockResolvedValueOnce(
      page([node('t2', 2), node('c', 3), node('t3', 4)]),
    );

    const result = await copyGlossaryRow({
      glossary,
      source,
      client,
      uuid: 'c',
    });

    expect(result).toEqual({ copied: true, entry: entry('c') });
    expect(mockCopy).toHaveBeenCalledWith({
      client,
      workUuid: WORK,
      source,
      uuid: 'c',
    });
    expect(rows(glossary)).toContain('g.3 c');
  });

  it('reports a refused copy and places nothing', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: false,
      reason: 'forbidden',
      error: 'Permission denied',
      outcomeUnknown: false,
    });

    const result = await copyGlossaryRow({ glossary, source, client });

    expect(result).toEqual({ copied: false, error: 'Permission denied' });
    expect(rows(glossary)).toHaveLength(3);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('reads the copy back when its answer was lost', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: false,
      reason: 'failed',
      error: 'network',
      outcomeUnknown: true,
    });
    mockRead.mockResolvedValue({ status: 'found', entry: entry('c') });
    mockPage.mockResolvedValueOnce(page([node('t3', 3), node('c', 4)]));

    const result = await copyGlossaryRow({
      glossary,
      source,
      client,
      uuid: 'c',
    });

    expect(mockRead).toHaveBeenCalledWith({
      client,
      workUuid: WORK,
      uuid: 'c',
    });
    expect(result).toEqual({ copied: true, entry: entry('c') });
    expect(rows(glossary).at(-1)).toBe('g.4 c');
  });

  it('reports a lost copy that was not made', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: false,
      reason: 'failed',
      error: 'network',
      outcomeUnknown: true,
    });
    mockRead.mockResolvedValue({ status: 'not-found' });

    const result = await copyGlossaryRow({ glossary, source, client });

    expect(result).toEqual({ copied: false, error: 'network' });
  });

  it('still reports the copy when placing its row fails', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: true,
      dryRun: false,
      entries: [entry('c')],
      deleted: [],
      changes: {},
    });
    mockPage.mockRejectedValueOnce(new Error('offline'));

    const result = await copyGlossaryRow({ glossary, source, client });

    expect(result).toEqual({ copied: true, entry: entry('c') });
    expect(rows(glossary)).toHaveLength(3);
  });
});
