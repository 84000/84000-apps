import type { Annotation, Passage } from './types';
import {
  findLiteralOccurrences,
  getPassageOccurrences,
  replacePassageText,
} from './replace';

const createAnnotation = ({
  end,
  start,
  uuid,
}: {
  end: number;
  start: number;
  uuid: string;
}): Annotation => ({
  end,
  start,
  passageUuid: 'passage-1',
  type: 'paragraph',
  uuid,
});

const createPassage = (
  content: string,
  annotations: Annotation[] = [],
): Passage => ({
  annotations,
  content,
  label: '1.1',
  sort: 1,
  type: 'translation',
  uuid: 'passage-1',
  workUuid: 'work-1',
});

describe('findLiteralOccurrences', () => {
  it('returns non-overlapping matches in order', () => {
    expect(findLiteralOccurrences('aba aba aba', 'aba')).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 11 },
    ]);
  });

  it('returns no matches for an empty search string', () => {
    expect(findLiteralOccurrences('abc', '')).toEqual([]);
  });
});

describe('getPassageOccurrences', () => {
  it('flattens matches across passages with stable indices', () => {
    expect(
      getPassageOccurrences(
        [
          { uuid: 'p1', content: 'foo foo' },
          { uuid: 'p2', content: 'foo' },
        ],
        'foo',
      ),
    ).toEqual([
      { passageUuid: 'p1', start: 0, end: 3, index: 0, passageOccurrenceIndex: 0 },
      { passageUuid: 'p1', start: 4, end: 7, index: 1, passageOccurrenceIndex: 1 },
      { passageUuid: 'p2', start: 0, end: 3, index: 2, passageOccurrenceIndex: 0 },
    ]);
  });
});

describe('replacePassageText', () => {
  it('replaces one indexed occurrence inside a single passage', () => {
    const result = replacePassageText({
      passage: createPassage('foo foo foo'),
      searchText: 'foo',
      replaceText: 'bar',
      occurrenceIndex: 1,
    });

    expect(result.passage.content).toBe('foo bar foo');
    expect(result.replacementsApplied).toBe(1);
  });

  it('replaces all occurrences when no occurrence index is provided', () => {
    const result = replacePassageText({
      passage: createPassage('foo foo'),
      searchText: 'foo',
      replaceText: 'x',
    });

    expect(result.passage.content).toBe('x x');
    expect(result.replacementsApplied).toBe(2);
  });

  it('preserves an annotation spanning across replaced text', () => {
    const result = replacePassageText({
      passage: createPassage('0123456789', [
        createAnnotation({ uuid: 'a1', start: 1, end: 9 }),
      ]),
      searchText: '345',
      replaceText: 'XX',
    });

    expect(result.passage.annotations[0]).toMatchObject({ start: 1, end: 8 });
    expect(result.updatedAnnotationCount).toBe(1);
  });

  it('clamps an annotation that overlaps the left edge of the replaced range', () => {
    const result = replacePassageText({
      passage: createPassage('0123456789', [
        createAnnotation({ uuid: 'a1', start: 2, end: 4 }),
      ]),
      searchText: '345',
      replaceText: 'XYZ',
    });

    expect(result.passage.annotations[0]).toMatchObject({ start: 2, end: 6 });
  });

  it('shifts annotations that occur entirely after the replaced text', () => {
    const result = replacePassageText({
      passage: createPassage('0123456789', [
        createAnnotation({ uuid: 'a1', start: 8, end: 10 }),
      ]),
      searchText: '34',
      replaceText: 'ABCDE',
    });

    expect(result.passage.annotations[0]).toMatchObject({ start: 11, end: 13 });
  });

  it('deletes an annotation that is fully removed by an empty replacement', () => {
    const result = replacePassageText({
      passage: createPassage('abc', [
        createAnnotation({ uuid: 'a1', start: 0, end: 3 }),
      ]),
      searchText: 'abc',
      replaceText: '',
    });

    expect(result.passage.annotations).toEqual([]);
    expect(result.deletedAnnotationCount).toBe(1);
  });

  it('maps an annotation contained within the replaced range onto the inserted replacement', () => {
    const result = replacePassageText({
      passage: createPassage('abc def ghi', [
        createAnnotation({ uuid: 'a1', start: 4, end: 7 }),
      ]),
      searchText: 'def',
      replaceText: 'uvwxyz',
    });

    expect(result.passage.annotations[0]).toMatchObject({ start: 4, end: 10 });
  });
});
