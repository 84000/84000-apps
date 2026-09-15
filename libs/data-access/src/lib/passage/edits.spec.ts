import { applyEditsToPassages, type PassageEdit } from './edits';
import { annotationsFromDTO } from '../types';
import type { AnnotationDTO, Passage } from '../types';

const WORK = 'w1';

// "Then the lord [F.90.a] said this" — the marker occupies 14..23, with a
// glossary instance on "lord" before it and an end-note marker after it.
const CONTENT = 'Then the lord [F.90.a] said this';

const annotationDtos: AnnotationDTO[] = [
  {
    uuid: 'a-glossary',
    passage_uuid: 'p1',
    type: 'glossary-instance',
    start: 9,
    end: 13,
    content: [{ uuid: 'g1', authority: 'au1' }],
  },
  {
    uuid: 'a-marker',
    passage_uuid: 'p1',
    type: 'deprecated-reference' as AnnotationDTO['type'],
    start: 14,
    end: 23,
    content: [{ title: '[F.90.a]' }],
  },
  {
    uuid: 'a-note',
    passage_uuid: 'p1',
    type: 'end-note-link',
    start: 27,
    end: 27,
    content: [{ uuid: 'n1' }],
  },
];

const passage = (): Passage => ({
  uuid: 'p1',
  workUuid: WORK,
  content: CONTENT,
  label: '1.10',
  sort: 548,
  type: 'translation',
  xmlId: 'x-1',
  annotations: annotationsFromDTO(annotationDtos, CONTENT.length),
});

const run = (edits: PassageEdit[]) =>
  applyEditsToPassages({ workUuid: WORK, passages: [passage()], edits });

const at = (result: ReturnType<typeof run>, uuid: string) =>
  result.passages[0].annotations.find((a) => a.uuid === uuid);

const REMOVE_MARKER: PassageEdit[] = [
  { op: 'delete-text', passageUuid: 'p1', start: 14, end: 23 },
  { op: 'remove-annotation', passageUuid: 'p1', annotationUuid: 'a-marker' },
  {
    op: 'add-annotation',
    passageUuid: 'p1',
    kind: 'mention',
    start: 14,
    data: { entity: 'folio-1', linkType: 'folio', isSameWork: true },
  },
];

describe('applyEditsToPassages', () => {
  it('cuts the deleted span out of the content', () => {
    expect(run(REMOVE_MARKER).passages[0].content).toBe(
      'Then the lord said this',
    );
  });

  it('leaves an annotation before the cut where it was', () => {
    expect(at(run(REMOVE_MARKER), 'a-glossary')).toMatchObject({
      start: 9,
      end: 13,
    });
  });

  it('shifts an annotation after the cut back by what was removed', () => {
    // 27 - 9 removed characters.
    expect(at(run(REMOVE_MARKER), 'a-note')).toMatchObject({
      start: 18,
      end: 18,
    });
  });

  it('places an added annotation at the mapped position of the offset given', () => {
    const mention = run(REMOVE_MARKER).passages[0].annotations.find(
      (a) => a.type === 'mention',
    );
    expect(mention).toMatchObject({ start: 14, end: 14 });
  });

  it('removes only the annotation named', () => {
    const result = run(REMOVE_MARKER);
    expect(at(result, 'a-marker')).toBeUndefined();
    expect(at(result, 'a-glossary')).toBeDefined();
    expect(at(result, 'a-note')).toBeDefined();
  });

  it('carries through annotations the edits never mention', () => {
    const result = run([
      { op: 'delete-text', passageUuid: 'p1', start: 0, end: 0 },
    ]);
    expect(result.passages[0].annotations.map((a) => a.uuid).sort()).toEqual([
      'a-glossary',
      'a-marker',
      'a-note',
    ]);
  });

  it('keeps an unmodelled annotation recoverable as the type it was stored with', () => {
    const marker = at(
      run([{ op: 'delete-text', passageUuid: 'p1', start: 0, end: 0 }]),
      'a-marker',
    );
    expect(marker).toMatchObject({
      type: 'unknown',
      dtoType: 'deprecated-reference',
      dtoContent: [{ title: '[F.90.a]' }],
    });
  });

  it('drops an annotation whose text was entirely deleted, and says why', () => {
    const result = run([
      { op: 'delete-text', passageUuid: 'p1', start: 9, end: 13 },
    ]);
    expect(at(result, 'a-glossary')).toBeUndefined();
    expect(result.warnings[0].message).toContain('a-glossary');
  });

  it('keeps a zero-length annotation that sits inside no deletion', () => {
    const result = run([
      { op: 'delete-text', passageUuid: 'p1', start: 0, end: 5 },
    ]);
    expect(at(result, 'a-note')).toMatchObject({ start: 22, end: 22 });
  });

  it('applies several deletions in one passage without drift', () => {
    const result = run([
      { op: 'delete-text', passageUuid: 'p1', start: 14, end: 23 },
      { op: 'delete-text', passageUuid: 'p1', start: 0, end: 5 },
    ]);
    expect(result.passages[0].content).toBe('the lord said this');
    // 27 - 9 - 5.
    expect(at(result, 'a-note')).toMatchObject({ start: 13 });
  });

  it('leaves a passage with no edits out of the payload', () => {
    const result = applyEditsToPassages({
      workUuid: WORK,
      passages: [passage(), { ...passage(), uuid: 'p2' }],
      edits: [{ op: 'delete-text', passageUuid: 'p1', start: 0, end: 1 }],
    });
    expect(result.passages.map((p) => p.uuid)).toEqual(['p1']);
  });

  it('inserts a passage at the anchor sort, with no label by default', () => {
    const result = run([
      { op: 'insert-passage', before: 'p1', content: '[B1]' },
    ]);
    const inserted = result.passages.find((p) => p.content === '[B1]');
    expect(inserted).toMatchObject({
      sort: 548,
      label: '',
      workUuid: WORK,
      type: 'translation',
    });
    expect(inserted?.uuid).not.toBe('p1');
  });

  it('reports rather than writing when an annotation cannot be built', () => {
    const result = run([
      { op: 'add-annotation', passageUuid: 'p1', kind: 'mention', start: 0 },
    ]);
    expect(result.error).toContain('mention');
    expect(result.passages).toHaveLength(0);
  });

  it('reports an insert anchored to a passage that was not read', () => {
    const result = run([
      { op: 'insert-passage', before: 'nope', content: 'x' },
    ]);
    expect(result.error).toContain('nope');
  });
});
