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
  const offsets = (
    before: string,
    after: string,
    start: number,
    end: number,
  ) => {
    const map = offsetMap(before, after);
    return [map(start, 'start'), map(end, 'end')];
  };

  it('moves offsets after a single edit exactly', () => {
    expect(offsets('Body text', 'My body text', 5, 9)).toEqual([
      { offset: 8, exact: true },
      { offset: 12, exact: true },
    ]);
  });

  it('sends offsets inside the changed region to its edges, inexactly', () => {
    expect(offsets('abcXYZdef', 'abcQdef', 4, 5)).toEqual([
      { offset: 3, exact: false },
      { offset: 4, exact: false },
    ]);
  });

  it('puts text inserted where a row starts before it, and where it ends after', () => {
    expect(offsets('Body text', 'Body Xtext', 5, 9)).toEqual([
      { offset: 6, exact: true },
      { offset: 10, exact: true },
    ]);
    expect(offsets('Body text', 'BodyX text', 0, 4)[1]).toEqual({
      offset: 4,
      exact: true,
    });
  });

  it('does not split a surrogate pair', () => {
    // The second emoji, at [3, 5), becomes the new one at [1, 3).
    expect(offsets('x\u{1F600}\u{1F600}y', 'x\u{1F601}y', 3, 5)).toEqual([
      { offset: 1, exact: false },
      { offset: 3, exact: true },
    ]);
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

  it('leaves a row inside text changed in two places as stored', () => {
    // Stretching it over the whole changed region would lose where it was.
    const { moved, warnings } = remap('foo X foo', 'bar X bar', [
      quote('x', 4, 5),
      quote('first', 0, 3),
    ]);
    expect(moved).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  it('clamps a row an edit cut through when it would not fit as stored', () => {
    const { moved } = remap('Body text', 'Body', [quote('q', 2, 7)]);
    expect(moved).toEqual([expect.objectContaining({ start: 2, end: 4 })]);
  });

  it('keeps a zero-length row zero-length at an insertion', () => {
    const { moved } = remap('Body text', 'Body Xtext', [quote('q', 5, 5)]);
    expect(moved).toEqual([expect.objectContaining({ start: 6, end: 6 })]);
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
