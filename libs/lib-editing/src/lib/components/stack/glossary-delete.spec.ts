import type {
  DataClient,
  GlossaryEntry,
  GlossaryTermNode,
} from '@eightyfourthousand/data-access';

import { deleteGlossaryRow, removeGlossaryInstances } from './glossary-delete';
import { loadGlossaryWork, type GlossaryWork } from './glossary-work';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockPage = jest.fn();
const mockEntries = jest.fn();
const mockDelete = jest.fn();
const mockRead = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: unknown) => mockPage(args),
  getGlossaryEntries: (args: unknown) => mockEntries(args),
  deleteGlossaryEntry: (args: unknown) => mockDelete(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
}));

const WORK = 'w1';
const client = {} as DataClient;

const entry = (uuid: string): GlossaryEntry => ({
  uuid,
  workUuid: WORK,
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

const deleted = (uuid: string) => ({
  success: true,
  dryRun: false,
  entries: [],
  deleted: [uuid],
  changes: {},
});

const refused = (reason: string, outcomeUnknown = false) => ({
  success: false,
  reason,
  error: `refused: ${reason}`,
  outcomeUnknown,
});

/** A passage with an instance of each of `entries`. */
const passageWith = (uuid: string, entries: string[]) => ({
  type: 'paragraph',
  attrs: { uuid },
  content: entries.flatMap((glossary, i) => [
    { type: 'text', text: ' a ' },
    {
      type: 'text',
      text: glossary,
      marks: [
        {
          type: 'glossaryInstance',
          attrs: { uuid: `i-${uuid}-${i}`, glossary },
        },
      ],
    },
  ]),
});

const instancesIn = (
  work: ReturnType<typeof createStackWorkDocument>,
  uuid: string,
) => {
  const found: string[] = [];
  work.store
    .ensure(uuid)
    .toNode()
    .descendants((each) => {
      each.marks.forEach((mark) => found.push(mark.attrs.glossary));
      return true;
    });
  return found;
};

const passages = () => {
  const work = createStackWorkDocument({ workUuid: WORK });
  work.seedSpine([
    { uuid: 'p1', label: '1', type: 'translation' },
    { uuid: 'p2', label: '2', type: 'translation' },
  ]);
  work.store.create('p1', [passageWith('p1', ['t2', 't1'])]);
  work.store.create('p2', [passageWith('p2', ['t2'])]);
  return work;
};

const loaded = async () => {
  mockPage.mockResolvedValue({
    nodes: [node('t1', 1), node('t2', 2), node('t3', 3)],
    pageInfo: { nextCursor: 't3', hasMoreAfter: true, hasMoreBefore: false },
    totalCount: 9,
  });
  mockEntries.mockImplementation(async ({ uuids }: { uuids: string[] }) =>
    uuids.map(entry),
  );
  const glossary = await loadGlossaryWork({
    workUuid: WORK,
    client,
    graphql: {} as never,
  });
  if (!glossary) throw new Error('not loaded');
  await glossary.work.hydrateWindow({ start: 0, end: 3 });
  return glossary;
};

const labels = (glossary: GlossaryWork) =>
  glossary.work.spine.entries().map(({ uuid, label }) => `${uuid}:${label}`);

let glossary: GlossaryWork;

beforeEach(async () => {
  jest.resetAllMocks();
  glossary = await loaded();
});

afterEach(() => glossary.work.destroy());

describe('deleteGlossaryRow', () => {
  it('deletes the entry, takes its row out and renumbers the rows after it', async () => {
    mockDelete.mockResolvedValue(deleted('t2'));
    const result = await deleteGlossaryRow({
      glossary,
      uuid: 't2',
      client,
      passages: [],
    });
    expect(result).toEqual({ deleted: true });
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: WORK, uuid: 't2' }),
    );
    expect(labels(glossary)).toEqual(['t1:g.1', 't3:g.2']);
    expect(glossary.entries.has('t2')).toBe(false);
    expect(glossary.work.spine.removedSinceSave()).toEqual([]);
  });

  it('renumbers from g.1 when the first row goes', async () => {
    mockDelete.mockResolvedValue(deleted('t1'));
    await deleteGlossaryRow({ glossary, uuid: 't1', client, passages: [] });
    expect(labels(glossary)).toEqual(['t2:g.1', 't3:g.2']);
  });

  it("takes the entry's instances out of loaded passages without dirtying them", async () => {
    const work = passages();
    mockDelete.mockResolvedValue(deleted('t2'));
    await deleteGlossaryRow({
      glossary,
      uuid: 't2',
      client,
      passages: [work],
    });
    expect(instancesIn(work, 'p1')).toEqual(['t1']);
    expect(instancesIn(work, 'p2')).toEqual([]);
    expect(work.store.ensure('p1').text).toBe(' a t2 a t1');
    expect(work.store.ensure('p1').isDirty).toBe(false);
    expect(work.store.ensure('p2').isDirty).toBe(false);
    work.destroy();
  });

  it('leaves nothing to save for a row deleted with unsaved edits', async () => {
    const doc = glossary.work.store.peek('t2');
    doc?.replaceContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    doc?.markDirty();
    glossary.conflicts.set('t2', { theirs: null });
    mockDelete.mockResolvedValue(deleted('t2'));
    await deleteGlossaryRow({ glossary, uuid: 't2', client, passages: [] });
    expect(glossary.work.store.isDirty).toBe(false);
    expect(glossary.work.store.peek('t2')).toBeNull();
    expect(glossary.conflicts.get('t2')).toBeNull();
  });

  it("lets go of the row's editors before its document is released", async () => {
    mockDelete.mockResolvedValue(deleted('t2'));
    const held: unknown[] = [];
    const letGo = jest.fn(() => held.push(glossary.work.store.peek('t2')));
    await deleteGlossaryRow({
      glossary,
      uuid: 't2',
      client,
      passages: [],
      letGo,
    });
    expect(letGo).toHaveBeenCalledTimes(1);
    expect(held[0]).toBeTruthy();
    expect(glossary.work.store.peek('t2')).toBeNull();
  });

  it('keeps reading past a deleted last row from the row before it', async () => {
    mockDelete.mockResolvedValue(deleted('t3'));
    await deleteGlossaryRow({ glossary, uuid: 't3', client, passages: [] });
    mockPage.mockResolvedValue({
      nodes: [node('t4', 3)],
      pageInfo: { nextCursor: 't4', hasMoreAfter: false },
      totalCount: 8,
    });
    await glossary.feed.extend();
    expect(mockPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 't2', direction: 'FORWARD' }),
    );
    expect(labels(glossary)).toEqual(['t1:g.1', 't2:g.2', 't4:g.3']);
  });

  it('changes nothing when the delete is refused', async () => {
    const work = passages();
    mockDelete.mockResolvedValue(refused('forbidden'));
    const result = await deleteGlossaryRow({
      glossary,
      uuid: 't2',
      client,
      passages: [work],
    });
    expect(result).toEqual({ deleted: false, error: 'refused: forbidden' });
    expect(glossary.work.store.peek('t2')).toBeTruthy();
    expect(labels(glossary)).toEqual(['t1:g.1', 't2:g.2', 't3:g.3']);
    expect(glossary.entries.has('t2')).toBe(true);
    expect(instancesIn(work, 'p2')).toEqual(['t2']);
    work.destroy();
  });

  it('takes out an entry already deleted elsewhere', async () => {
    mockDelete.mockResolvedValue(refused('not-found'));
    const result = await deleteGlossaryRow({
      glossary,
      uuid: 't2',
      client,
      passages: [],
    });
    expect(result).toEqual({ deleted: true });
    expect(labels(glossary)).toEqual(['t1:g.1', 't3:g.2']);
  });

  it('reads the entry back when the answer was lost', async () => {
    mockDelete.mockResolvedValue(refused('failed', true));
    mockRead.mockResolvedValue({ status: 'not-found' });
    expect(
      await deleteGlossaryRow({ glossary, uuid: 't2', client, passages: [] }),
    ).toEqual({ deleted: true });

    mockRead.mockResolvedValue({ status: 'found', entry: entry('t3') });
    expect(
      await deleteGlossaryRow({ glossary, uuid: 't3', client, passages: [] }),
    ).toEqual({ deleted: false, error: 'refused: failed' });
    expect(labels(glossary)).toEqual(['t1:g.1', 't3:g.2']);
  });
});

describe('removeGlossaryInstances', () => {
  it("keeps a passage's own edits, and its dirty state", () => {
    const work = passages();
    work.store.ensure('p2').markDirty();
    removeGlossaryInstances(work, 't2');
    expect(instancesIn(work, 'p2')).toEqual([]);
    expect(work.store.ensure('p2').isDirty).toBe(true);
    work.destroy();
  });
});
