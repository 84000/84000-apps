import { planEndNoteCleanup } from './deletion';
import type { AnnotationWriteRow } from './types';

const link = (uuid: string, cites: string): AnnotationWriteRow => ({
  uuid,
  passage_uuid: 'citing',
  type: 'end-note-link',
  start: 0,
  end: 1,
  content: [{ uuid: cites }] as never,
  toh: null,
});

describe('planEndNoteCleanup', () => {
  it('judges each link by the content it will have once saved', () => {
    const retargeted = link('retargeted', 'kept-note');
    const pointedAt = link('pointed-at', 'gone-note');
    const fresh = link('fresh', 'gone-note');
    const other = link('other', 'kept-note');

    const plan = planEndNoteCleanup({
      // Stored links that cite the deleted note.
      storedReferences: ['untouched', 'retargeted'],
      upserts: [retargeted, pointedAt, fresh],
      unchanged: [other],
      stored: new Set(['retargeted', 'pointed-at', 'other']),
      deletedPassageUuids: ['gone-note'],
    });

    expect(plan.upserts).toEqual([retargeted]);
    expect(plan.deletes.sort()).toEqual(['pointed-at', 'untouched']);
  });

  it('changes nothing when no passage is deleted', () => {
    const upserts = [link('a', 'note')];
    expect(
      planEndNoteCleanup({
        storedReferences: [],
        upserts,
        unchanged: [],
        stored: new Set(),
        deletedPassageUuids: [],
      }),
    ).toEqual({ upserts, deletes: [] });
  });
});
