import type { ExistingAnnotationRow } from './diff';
import { offsetMap, remapIgnoredRows } from './remap';

const quote = (
  uuid: string,
  start: number,
  end: number,
): ExistingAnnotationRow => ({
  uuid,
  passage_uuid: 'p',
  type: 'quote',
  start,
  end,
  content: [],
});

const remap = (
  before: string,
  after: string,
  rows: ExistingAnnotationRow[],
  skip: (row: ExistingAnnotationRow) => boolean = () => false,
) =>
  remapIgnoredRows({
    existing: rows,
    storedContent: new Map([['p', before]]),
    content: new Map([['p', after]]),
    skip,
  });

describe('offsetMap', () => {
  it('moves offsets after a single edit exactly', () => {
    const map = offsetMap('Body text', 'My body text');
    expect([map(5, 'start'), map(9, 'end')]).toEqual([8, 12]);
  });

  it('sends offsets inside the changed region to its edges', () => {
    const map = offsetMap('abcXYZdef', 'abcQdef');
    expect([map(4, 'start'), map(5, 'end')]).toEqual([3, 4]);
  });
});

describe('remapIgnoredRows', () => {
  it('moves a row after a single-region edit to the same text', () => {
    const { moved, warnings } = remap('Body text', 'My body text', [
      quote('q', 5, 9),
    ]);
    expect(moved).toEqual([expect.objectContaining({ start: 8, end: 12 })]);
    expect(warnings).toEqual([]);
  });

  it('keeps a row in range across an edit in two places', () => {
    const { moved } = remap('Body text', 'Bodies texts', [quote('q', 5, 9)]);
    expect(moved).toEqual([expect.objectContaining({ start: 3, end: 12 })]);
  });

  it('leaves a row that would collapse as stored, with a warning', () => {
    // The first "a" was deleted, but the diff cannot tell which one went.
    const { moved, warnings } = remap('aaa', 'aa', [quote('q', 2, 3)]);
    expect(moved).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('Annotation q')]);
  });

  it('leaves a row in a split-off tail as stored, with a warning', () => {
    const { moved, warnings } = remap('abcdef', 'abc', [quote('q', 4, 6)]);
    expect(moved).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('leaves a row already out of range as stored, with a warning', () => {
    const { moved, warnings } = remap('Body text', 'Body texts', [
      quote('q', 5, 20),
    ]);
    expect(moved).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('already out of range')]);
  });

  it('moves nothing when the text is unchanged, skipped, or not ignored', () => {
    expect(remap('Body', 'Body', [quote('q', 0, 4)]).moved).toEqual([]);
    expect(
      remap('Body text', 'My body text', [quote('q', 5, 9)], () => true).moved,
    ).toEqual([]);
    expect(
      remap('Body text', 'My body text', [
        { ...quote('q', 5, 9), type: 'paragraph' },
      ]).moved,
    ).toEqual([]);
  });
});
