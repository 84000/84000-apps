import { Schema } from '@tiptap/pm/model';
import { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { dirtyPassages, saveStackWork } from './stack-save';

// Only the two writes are stubbed: `Spine` reads `panelAndTabForContentType`
// from this module, so replacing the whole of it breaks seeding.
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
  savePassagesWithDeletions: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  savePassagesWithDeletions: jest.Mock;
};

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

const para = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

/** A work of three passages, none of them edited yet. */
const build = () => {
  const work = new WorkDocument({ workUuid: 'w1', schema });
  work.seedSpine([
    { uuid: 'p0', label: '1', type: 'translation' },
    { uuid: 'p1', label: '2', type: 'translation' },
    { uuid: 'p2', label: '3', type: 'translation' },
  ]);
  ['p0', 'p1', 'p2'].forEach((uuid, i) =>
    work.store.create(uuid, [para(`text ${i}`)]),
  );
  ['p0', 'p1', 'p2'].forEach((uuid) => work.store.peek(uuid)?.markSynced());
  return work;
};

/** Edit a passage, so its own document reports itself dirty. */
const edit = (work: WorkDocument, uuid: string, text: string) =>
  work.store.ensure(uuid).replaceContent({ type: 'doc', content: [para(text)] });

describe('dirtyPassages', () => {
  beforeEach(() => dataAccess.savePassagesWithDeletions.mockReset());

  // The point of the per-passage model: a save costs the number of edits, not
  // the size of the work.
  it('materializes only the passages that were edited', () => {
    const work = build();
    edit(work, 'p1', 'changed');

    expect(dirtyPassages(work).map((passage) => passage.uuid)).toEqual(['p1']);
  });

  it('takes identity from the spine and sort from position', () => {
    const work = build();
    edit(work, 'p2', 'changed');

    const [passage] = dirtyPassages(work);
    expect(passage.label).toBe('3');
    expect(passage.sort).toBe(work.spine.sortOf('p2'));
  });
});

describe('saveStackWork', () => {
  beforeEach(() => dataAccess.savePassagesWithDeletions.mockReset());

  it('writes nothing when nothing was edited', async () => {
    await saveStackWork(build());
    expect(dataAccess.savePassagesWithDeletions).not.toHaveBeenCalled();
  });

  it('marks a passage synced once the server has it', async () => {
    const work = build();
    edit(work, 'p0', 'changed');
    dataAccess.savePassagesWithDeletions.mockResolvedValue({ success: true });

    expect(await saveStackWork(work)).toBe(true);
    expect(work.store.dirty()).toEqual([]);
  });

  // A document marked synced on a failed write would drop the edit from the
  // next save.
  it('leaves a passage dirty when the write fails', async () => {
    const work = build();
    edit(work, 'p0', 'changed');
    dataAccess.savePassagesWithDeletions.mockResolvedValue({
      success: false,
      error: 'nope',
    });

    expect(await saveStackWork(work)).toBe(false);
    expect(work.store.dirty()).toEqual(['p0']);
  });
});
