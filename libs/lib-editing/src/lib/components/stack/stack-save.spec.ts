import { Schema } from '@tiptap/pm/model';
import {
  annotationsFromDTO,
  passageFromDTO,
  type PassageDTO,
} from '@eightyfourthousand/data-access';
import { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { dirtyPassages, saveStackWork } from './stack-save';
import { createStackWorkDocument } from './stack-work';
import { stackSeedFromPassage } from './types';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

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
  work.store
    .ensure(uuid)
    .replaceContent({ type: 'doc', content: [para(text)] });

describe('dirtyPassages', () => {
  beforeEach(() => dataAccess.savePassagesWithDeletions.mockReset());

  // The point of the per-passage model: a save costs the number of edits, not
  // the size of the work.
  it('materializes only the passages that were edited', () => {
    const work = build();
    edit(work, 'p1', 'changed');

    expect(dirtyPassages(work).map((passage) => passage.uuid)).toEqual(['p1']);
  });

  // toh251 1.2 as seeded: a comment over the second half of a glossary
  // instance renders the instance as two segments sharing its uuid. Exported
  // as-is that is two rows with one primary key, and Postgres rejects the
  // whole annotation write.
  it('exports a split annotation as contiguous rows with distinct uuids', () => {
    const text = 'residing in Jeta’s Grove, Anāthapiṇḍada’s park, together';
    const start = text.indexOf('Jeta');
    const split = text.indexOf('Anātha');
    const end = text.indexOf(', together');
    const dto: PassageDTO = {
      uuid: 'p1',
      work_uuid: 'w1',
      sort: 1,
      type: 'translation',
      label: '1.2',
      xmlId: 'x',
      parent: 'y',
      content: text,
      annotations: [
        {
          uuid: 'glossary-1',
          passage_uuid: 'p1',
          type: 'glossary-instance',
          start,
          end,
          content: [{ uuid: 'term-1' }, { authority: 'authority-1' }],
        },
        {
          uuid: 'comment-1',
          passage_uuid: 'p1',
          type: 'comment',
          start: split,
          end,
          content: [{ uuid: 'thread-1' }],
        },
      ],
    };
    const seed = stackSeedFromPassage(
      passageFromDTO(
        dto,
        annotationsFromDTO(dto.annotations ?? [], text.length),
      ),
    );
    const work = createStackWorkDocument({ workUuid: 'w1' });
    work.seedSpine([seed.meta]);
    work.store.create('p1', seed.content);
    // An edit that leaves the marks in place: type at the end of the passage.
    const edited = JSON.parse(JSON.stringify(seed.content));
    edited[0].content.push({ type: 'text', text: ' edited' });
    work.store.ensure('p1').replaceContent({ type: 'doc', content: edited });

    const [passage] = dirtyPassages(work);
    const uuids = passage.annotations.map((a) => a.uuid);
    expect(new Set(uuids).size).toBe(uuids.length);

    const glossary = passage.annotations
      .filter((a) => a.type === 'glossaryInstance')
      .sort((a, b) => a.start - b.start);
    expect(glossary.map((a) => [a.start, a.end])).toEqual([
      [start, split],
      [split, end],
    ]);
    expect(glossary[0].uuid).toBe('glossary-1');

    // Written back, so the next save sends the same rows.
    const again = dirtyPassages(work)[0].annotations.map((a) => a.uuid);
    expect(again.sort()).toEqual([...uuids].sort());
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

  // The spine holds part of a work, so position is not a row's sort: saving
  // 1.2 wrote sort 1, and it jumped ahead of the front matter.
  it('sends stored sorts, and adopts the sort of a passage it created', async () => {
    const work = new WorkDocument({ workUuid: 'w1', schema });
    work.seedSpine([
      { uuid: 'a', label: '1.1', type: 'translation', sort: 169 },
      { uuid: 'b', label: '1.2', type: 'translation', sort: 170 },
      { uuid: 'c', label: '1.3', type: 'translation', sort: 171 },
    ]);
    ['a', 'b', 'c'].forEach((uuid) => {
      work.store.create(uuid, [para(uuid)]);
      work.store.peek(uuid)?.markSynced();
    });
    edit(work, 'b', 'changed');
    const created = work.split('a', 1);
    dataAccess.savePassagesWithDeletions.mockResolvedValue({ success: true });

    await saveStackWork(work);

    const sent = dataAccess.savePassagesWithDeletions.mock.calls[0][0]
      .passages as { uuid: string; sort: number }[];
    const sortOf = (uuid: string) => sent.find((p) => p.uuid === uuid)?.sort;
    expect(sortOf('b')).toBe(170);
    expect(sortOf(created?.uuid ?? '')).toBe(170);

    // The server shifted 170–171 up to make room; the spine follows.
    expect(
      ['a', created?.uuid ?? '', 'b', 'c'].map(
        (uuid) => work.spine.meta(uuid)?.sort,
      ),
    ).toEqual([169, 170, 171, 172]);
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
