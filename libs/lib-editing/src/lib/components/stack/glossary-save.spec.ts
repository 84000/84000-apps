import type {
  DataClient,
  GlossaryEntry,
  GlossaryTermNode,
} from '@eightyfourthousand/data-access';

import {
  discardGlossaryEdit,
  keepMyGlossaryEntry,
  saveGlossaryWork,
  takeTheirGlossaryEntry,
  unsavedGlossaryChanges,
} from './glossary-save';
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
const mockSave = jest.fn();
const mockRead = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: unknown) => mockPage(args),
  getGlossaryEntries: (args: unknown) => mockEntries(args),
  saveGlossaryEntry: (args: unknown) => mockSave(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
}));

const WORK = 'w1';
const client = {} as DataClient;

const STORED: Record<string, string> = {
  t1: '<note type="definition"> <p class="definition">A <span data-glossary-id="x">god</span>.</p> </note>',
  t2: '<p>A king.</p>',
};

const entry = (uuid: string, definition = STORED[uuid]): GlossaryEntry => ({
  uuid,
  workUuid: WORK,
  authorityUuid: `a-${uuid}`,
  definition,
  definitionRend: null,
  glossMode: 'match',
  names: [],
});

const node = (uuid: string, termNumber: number) =>
  ({
    uuid,
    authority: `a-${uuid}`,
    termNumber,
    definition: STORED[uuid],
    names: { english: uuid },
  }) as GlossaryTermNode;

const saved = (stored: GlossaryEntry) => ({
  success: true,
  dryRun: false,
  entries: [stored],
  deleted: [],
  changes: {},
});

const refused = (reason: string, outcomeUnknown = false) => ({
  success: false,
  reason,
  error: reason,
  outcomeUnknown,
});

const loaded = async () => {
  mockPage.mockResolvedValue({
    nodes: [node('t1', 1), node('t2', 2)],
    pageInfo: { hasMoreAfter: false, hasMoreBefore: false },
    totalCount: 2,
  });
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
  return glossary;
};

/** Write `html`'s paragraph over a row, as an editor would. */
const edit = (glossary: GlossaryWork, uuid: string, text: string) => {
  const doc = glossary.work.store.peek(uuid);
  doc?.replaceContent({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  doc?.markDirty();
};

const textOf = (glossary: GlossaryWork, uuid: string) =>
  glossary.work.store.peek(uuid)?.text;

let glossary: GlossaryWork;

beforeEach(async () => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  glossary = await loaded();
});

afterEach(() => glossary.work.destroy());

describe('saveGlossaryWork', () => {
  it('sends nothing for rows that were not edited', async () => {
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
    expect(await saveGlossaryWork(glossary, client)).toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('sends nothing for a row edited back to what it was', async () => {
    const doc = glossary.work.store.peek('t2');
    doc?.replaceContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'A king.' }] },
      ],
    });
    doc?.markDirty();
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
    expect(await saveGlossaryWork(glossary, client)).toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
    expect(doc?.isDirty).toBe(false);
  });

  it('saves an edited definition guarded by the entry it was read from', async () => {
    edit(glossary, 't2', 'A great king.');
    expect(unsavedGlossaryChanges(glossary)).toBe(1);
    mockSave.mockResolvedValue(saved(entry('t2', '<p>A great king.</p>')));

    expect(await saveGlossaryWork(glossary, client)).toBe(true);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        workUuid: WORK,
        before: entry('t2'),
        after: { definition: '<p>A great king.</p>' },
      }),
    );
    expect(glossary.work.store.peek('t2')?.isDirty).toBe(false);
    expect(glossary.entries.get('t2')?.definition).toBe('<p>A great king.</p>');
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
  });

  it('saves only the edited row of several', async () => {
    edit(glossary, 't1', 'A god of the sky.');
    mockSave.mockResolvedValue(saved(entry('t1', '<p>A god of the sky.</p>')));
    await saveGlossaryWork(glossary, client);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].before.uuid).toBe('t1');
  });

  it('keeps the local text of a refused save, and records the conflict', async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockResolvedValue(refused('stale'));
    mockRead.mockResolvedValue({
      status: 'found',
      entry: entry('t2', '<p>Theirs.</p>'),
    });

    expect(await saveGlossaryWork(glossary, client)).toBe(false);

    expect(textOf(glossary, 't2')).toBe('Mine.');
    expect(glossary.work.store.peek('t2')?.isDirty).toBe(true);
    expect(glossary.conflicts.get('t2')?.theirs?.definition).toBe(
      '<p>Theirs.</p>',
    );
    expect(unsavedGlossaryChanges(glossary)).toBe(1);
  });

  it('records an entry deleted elsewhere as a conflict with nothing stored', async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockResolvedValue(refused('not-found'));
    mockRead.mockResolvedValue({ status: 'not-found' });
    expect(await saveGlossaryWork(glossary, client)).toBe(false);
    expect(glossary.conflicts.get('t2')).toEqual({ theirs: null });
    expect(textOf(glossary, 't2')).toBe('Mine.');
  });

  it('settles a save whose answer was lost once the edit is found stored', async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockResolvedValue(refused('failed', true));
    mockRead.mockResolvedValue({
      status: 'found',
      entry: entry('t2', '<p>Mine.</p>'),
    });
    expect(await saveGlossaryWork(glossary, client)).toBe(true);
    expect(glossary.work.store.peek('t2')?.isDirty).toBe(false);
  });

  it('keeps a save whose answer was lost unsaved when the edit is not stored', async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockResolvedValue(refused('failed', true));
    mockRead.mockResolvedValue({ status: 'found', entry: entry('t2') });
    expect(await saveGlossaryWork(glossary, client)).toBe(false);
    expect(glossary.work.store.peek('t2')?.isDirty).toBe(true);
    expect(glossary.conflicts.get('t2')).toBeNull();
  });

  it('records no conflict for a row deleted from the work during its save', async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockImplementation(async () => {
      glossary.work.spine.remove(['t2'], { renumber: false });
      return refused('not-found');
    });
    mockRead.mockResolvedValue({ status: 'not-found' });
    await saveGlossaryWork(glossary, client);
    expect(glossary.conflicts.get('t2')).toBeNull();
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
  });

  it('keeps an edit made while the save was in flight', async () => {
    edit(glossary, 't2', 'First.');
    mockSave.mockImplementation(async () => {
      edit(glossary, 't2', 'Second.');
      return saved(entry('t2', '<p>First.</p>'));
    });
    await saveGlossaryWork(glossary, client);
    expect(glossary.work.store.peek('t2')?.isDirty).toBe(true);
    expect(unsavedGlossaryChanges(glossary)).toBe(1);
  });
});

describe('resolving a conflict', () => {
  const conflicted = async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockResolvedValueOnce(refused('stale'));
    mockRead.mockResolvedValue({
      status: 'found',
      entry: entry('t2', '<p>Theirs.</p>'),
    });
    await saveGlossaryWork(glossary, client);
  };

  it('takes theirs: the row shows the stored text and has nothing to save', async () => {
    await conflicted();
    takeTheirGlossaryEntry(glossary, 't2');
    expect(textOf(glossary, 't2')).toBe('Theirs.');
    expect(glossary.conflicts.get('t2')).toBeNull();
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
    expect(await saveGlossaryWork(glossary, client)).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('keeps mine: the next save writes it over the stored text', async () => {
    await conflicted();
    keepMyGlossaryEntry(glossary, 't2');
    expect(textOf(glossary, 't2')).toBe('Mine.');
    expect(glossary.conflicts.get('t2')).toBeNull();
    mockSave.mockResolvedValueOnce(saved(entry('t2', '<p>Mine.</p>')));
    expect(await saveGlossaryWork(glossary, client)).toBe(true);
    expect(mockSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        before: entry('t2', '<p>Theirs.</p>'),
        after: { definition: '<p>Mine.</p>' },
      }),
    );
  });

  it('waits for the choice: a later save does not send the row again', async () => {
    await conflicted();
    expect(await saveGlossaryWork(glossary, client)).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(glossary.conflicts.get('t2')).not.toBeNull();
    expect(unsavedGlossaryChanges(glossary)).toBe(1);
  });

  it('discards an edit to an entry deleted elsewhere', async () => {
    edit(glossary, 't2', 'Mine.');
    mockSave.mockResolvedValueOnce(refused('not-found'));
    mockRead.mockResolvedValue({ status: 'not-found' });
    await saveGlossaryWork(glossary, client);
    discardGlossaryEdit(glossary, 't2');
    expect(glossary.conflicts.get('t2')).toBeNull();
    expect(glossary.work.store.peek('t2')?.isDirty).toBe(false);
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
  });

  it('tells its listeners', async () => {
    const listener = jest.fn();
    glossary.conflicts.subscribe(listener);
    await conflicted();
    keepMyGlossaryEntry(glossary, 't2');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
