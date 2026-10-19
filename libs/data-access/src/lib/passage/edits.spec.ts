import { version as uuidVersion } from 'uuid';
import { applyEditsToPassages, type PassageEdit } from './edits';
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
  annotations: [],
});

const run = (edits: PassageEdit[]) =>
  applyEditsToPassages({
    workUuid: WORK,
    passages: [passage()],
    annotations: new Map([['p1', annotationDtos]]),
    edits,
  });

/** A cut of the stored text at `start`–`end`, naming what it removes. */
const cut = (start: number, end: number, content = CONTENT): PassageEdit => ({
  op: 'delete-text',
  passageUuid: 'p1',
  start,
  end,
  text: content.slice(start, end),
});

const at = (result: ReturnType<typeof run>, uuid: string) =>
  result.passages[0].annotations.find((a) => a.uuid === uuid);

const REMOVE_MARKER: PassageEdit[] = [
  cut(14, 23),
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
    const result = run([cut(0, 0)]);
    expect(result.passages[0].annotations.map((a) => a.uuid).sort()).toEqual([
      'a-glossary',
      'a-marker',
      'a-note',
    ]);
  });

  it('keeps an unmodelled annotation recoverable as the type it was stored with', () => {
    const marker = at(run([cut(0, 0)]), 'a-marker');
    expect(marker).toMatchObject({
      type: 'unknown',
      dtoType: 'deprecated-reference',
      dtoContent: [{ title: '[F.90.a]' }],
    });
  });

  it('drops an annotation whose text was entirely deleted, and says why', () => {
    const result = run([cut(9, 13)]);
    expect(at(result, 'a-glossary')).toBeUndefined();
    expect(result.warnings[0].message).toContain('a-glossary');
  });

  it('keeps a zero-length annotation that sits inside no deletion', () => {
    const result = run([cut(0, 5)]);
    expect(at(result, 'a-note')).toMatchObject({ start: 22, end: 22 });
  });

  it('applies several deletions in one passage without drift', () => {
    const result = run([cut(14, 23), cut(0, 5)]);
    expect(result.passages[0].content).toBe('the lord said this');
    // 27 - 9 - 5.
    expect(at(result, 'a-note')).toMatchObject({ start: 13 });
  });

  it('leaves a passage with no edits out of the payload', () => {
    const result = applyEditsToPassages({
      workUuid: WORK,
      passages: [passage(), { ...passage(), uuid: 'p2' }],
      annotations: new Map(),
      edits: [cut(0, 1)],
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

  // Several inserts before one passage share its sort; the save places them
  // by this anchor instead, so they don't tie.
  it('anchors each inserted passage to the one it goes before', () => {
    const result = run([
      { op: 'insert-passage', before: 'p1', content: '[B1]' },
      { op: 'insert-passage', before: 'p1', content: '[B2]' },
    ]);
    const inserted = result.passages.filter((p) => p.uuid !== 'p1');
    expect(inserted).toHaveLength(2);
    inserted.forEach((passage) =>
      expect(result.anchors[passage.uuid]).toEqual({ before: 'p1' }),
    );
  });

  it('reports rather than writing when an annotation cannot be built', () => {
    const result = run([
      { op: 'add-annotation', passageUuid: 'p1', kind: 'mention', start: 0 },
    ]);
    expect(result.error).toContain('mention');
    expect(result.passages).toHaveLength(0);
  });

  it('refuses a cut whose text is not what the range holds', () => {
    const result = run([
      {
        op: 'delete-text',
        passageUuid: 'p1',
        start: 14,
        end: 23,
        text: 'nope',
      },
    ]);
    expect(result.error).toMatch(/expected "nope" at 14–23 but found/);
    expect(result.passages).toEqual([]);
  });

  it('refuses an annotation whose text is not what the range holds', () => {
    const result = run([
      {
        op: 'add-annotation',
        passageUuid: 'p1',
        kind: 'glossary-instance',
        start: 5,
        end: 8,
        text: 'lord',
        data: { glossary: 'g1', authority: 'au1' },
      },
    ]);
    expect(result.error).toMatch(/expected "lord" at 5–8 but found "the"/);
    expect(result.passages).toEqual([]);
  });

  it('refuses an annotation with text whose range runs past the passage', () => {
    const result = run([
      {
        op: 'add-annotation',
        passageUuid: 'p1',
        kind: 'glossary-instance',
        start: 28,
        end: 99,
        text: 'this',
        data: { glossary: 'g1', authority: 'au1' },
      },
    ]);
    expect(result.error).toMatch(
      'expected "this" at 28–99 but the range runs past the passage, 32 characters',
    );
  });

  it('adds an annotation whose text matches the range', () => {
    const result = run([
      cut(14, 23),
      {
        op: 'add-annotation',
        passageUuid: 'p1',
        kind: 'glossary-instance',
        start: 28,
        end: 32,
        text: 'this',
        data: { glossary: 'g2', authority: 'au2' },
      },
    ]);
    expect(result.error).toBeUndefined();
    const added = result.passages[0].annotations.find(
      (a) => a.type === 'glossaryInstance' && a.start !== 9,
    );
    expect(added).toMatchObject({ start: 19, end: 23 });
    expect(result.passages[0].content.slice(19, 23)).toBe('this');
  });

  it('cannot tell a repeated cut from a new one when the text repeats', () => {
    // Cutting one "x" from "xx" leaves an "x" at the same offsets.
    const once = applyEditsToPassages({
      workUuid: WORK,
      passages: [{ ...passage(), content: 'xx' }],
      annotations: new Map(),
      edits: [cut(1, 2, 'xx')],
    });
    expect(once.passages[0].content).toBe('x');
    const twice = applyEditsToPassages({
      workUuid: WORK,
      passages: [{ ...passage(), content: 'x' }],
      annotations: new Map(),
      edits: [cut(0, 1, 'xx')],
    });
    expect(twice.error).toBeUndefined();
    expect(twice.passages[0].content).toBe('');
  });

  it('reports an insert anchored to a passage that was not read', () => {
    const result = run([
      { op: 'insert-passage', before: 'nope', content: 'x' },
    ]);
    expect(result.error).toContain('nope');
  });
});

describe('applyEditsToPassages with overlapping cuts', () => {
  const TEXT = 'abcdefghij';
  const letters = (): Passage => ({
    uuid: 'p1',
    workUuid: WORK,
    content: TEXT,
    label: '1',
    sort: 1,
    type: 'translation',
    annotations: [],
  });
  const rows: AnnotationDTO[] = [
    {
      uuid: 'on-h',
      passage_uuid: 'p1',
      type: 'span',
      start: 7,
      end: 8,
      content: [],
    },
    {
      uuid: 'on-b',
      passage_uuid: 'p1',
      type: 'span',
      start: 1,
      end: 2,
      content: [],
    },
  ];
  const cuts = (...ranges: [number, number][]) =>
    applyEditsToPassages({
      workUuid: WORK,
      passages: [letters()],
      annotations: new Map([['p1', rows]]),
      edits: ranges.map(([start, end]) => cut(start, end, TEXT)),
    });

  it('removes the union of overlapping cuts', () => {
    const result = cuts([2, 5], [4, 7]);
    const [passage] = result.passages;
    expect(passage.content).toBe('abhij');
    const h = passage.annotations.find((a) => a.uuid === 'on-h');
    expect(h).toMatchObject({ start: 2, end: 3 });
    expect(passage.content.slice(h?.start, h?.end)).toBe('h');
  });

  it('counts a repeated cut once and never goes negative', () => {
    const [passage] = cuts([0, 2], [0, 2]).passages;
    expect(passage.content).toBe('cdefghij');
    expect(passage.annotations.find((a) => a.uuid === 'on-h')).toMatchObject({
      start: 5,
      end: 6,
    });
    for (const annotation of passage.annotations) {
      expect(annotation.start).toBeGreaterThanOrEqual(0);
      expect(annotation.end).toBeGreaterThanOrEqual(0);
    }
  });

  it('refuses a reversed or out-of-bounds range', () => {
    expect(cuts([5, 2]).error).toMatch(/ordered and within/);
    expect(cuts([8, 11]).error).toMatch(/ordered and within/);
    expect(cuts([-1, 2]).error).toMatch(/ordered and within/);
  });
});

describe('applyEditsToPassages add-annotation uuids', () => {
  const mention = (entity: string): PassageEdit => ({
    op: 'add-annotation',
    passageUuid: 'p1',
    kind: 'mention',
    start: 4,
    data: { entity, linkType: 'folio', isSameWork: true },
  });
  const added = (result: ReturnType<typeof run>) =>
    result.rawAnnotations.p1.filter(
      (row) => !annotationDtos.some((stored) => stored.uuid === row.uuid),
    );

  it('derives the same v5 uuid each time the same add is sent', () => {
    const [first] = added(run([mention('folio-1')]));
    const [second] = added(run([mention('folio-1')]));

    expect(uuidVersion(first.uuid)).toBe(5);
    expect(second.uuid).toBe(first.uuid);
  });

  it('derives different uuids for different data at one position', () => {
    const [one, two] = added(run([mention('folio-1'), mention('folio-2')]));
    expect(one.uuid).not.toBe(two.uuid);
  });

  it('skips a resend once the first send is stored', () => {
    const [row] = added(run([mention('folio-1')]));
    const result = applyEditsToPassages({
      workUuid: WORK,
      passages: [passage()],
      annotations: new Map([['p1', [...annotationDtos, row]]]),
      edits: [mention('folio-1')],
    });

    expect(result.rawAnnotations.p1).toHaveLength(annotationDtos.length + 1);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('Skipped add-annotation'),
      }),
    ]);
  });

  it('re-adds an annotation removed in the same call under its uuid', () => {
    const [row] = added(run([mention('folio-1')]));
    const result = applyEditsToPassages({
      workUuid: WORK,
      passages: [passage()],
      annotations: new Map([['p1', [...annotationDtos, row]]]),
      edits: [
        {
          op: 'remove-annotation',
          passageUuid: 'p1',
          annotationUuid: row.uuid,
        },
        mention('folio-1'),
      ],
    });

    const uuids = result.rawAnnotations.p1.map((r) => r.uuid);
    expect(uuids.filter((u) => u === row.uuid)).toHaveLength(1);
    expect(uuids).toHaveLength(annotationDtos.length + 1);
  });

  it('keeps a random uuid when a deprecated row holds the derived one', () => {
    const [row] = added(run([mention('folio-1')]));
    const deprecated = {
      ...row,
      type: 'deprecated-temp-mention' as AnnotationDTO['type'],
    };
    const result = applyEditsToPassages({
      workUuid: WORK,
      passages: [passage()],
      annotations: new Map([['p1', [...annotationDtos, deprecated]]]),
      edits: [mention('folio-1')],
    });

    const [, fresh] = added(result);
    expect(uuidVersion(fresh.uuid)).toBe(4);
  });

  it('keeps a random uuid when a moved stored row holds the derived one', () => {
    const [row] = added(run([mention('folio-1')]));
    const moved = { ...row, start: 0, end: 0 };
    const result = applyEditsToPassages({
      workUuid: WORK,
      passages: [passage()],
      annotations: new Map([['p1', [...annotationDtos, moved]]]),
      edits: [mention('folio-1')],
    });

    const uuids = result.rawAnnotations.p1.map((r) => r.uuid);
    expect(new Set(uuids).size).toBe(uuids.length);
    const [kept, fresh] = added(result);
    expect(kept.uuid).toBe(row.uuid);
    expect(uuidVersion(fresh.uuid)).toBe(4);
  });
});
