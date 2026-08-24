import { splitMarks, TranslationMark } from './split-marks';

const rangedMark = (start: number, end: number): TranslationMark => ({
  type: 'italic',
  attrs: { start, end, uuid: 'mark-1', type: 'span' },
});

const positionlessMark: TranslationMark = {
  type: 'link',
  attrs: { href: 'https://84000.co', uuid: 'link-1', type: 'href' },
};

describe('splitMarks', () => {
  it('returns undefined when there are no marks', () => {
    expect(splitMarks({ start: 0, end: 10 })).toBeUndefined();
  });

  it('drops a mark that lies entirely before the segment', () => {
    const result = splitMarks({
      marks: [rangedMark(0, 5)],
      start: 10,
      end: 20,
    });

    expect(result).toEqual([]);
  });

  it('drops a mark that lies entirely after the segment', () => {
    const result = splitMarks({
      marks: [rangedMark(15, 20)],
      start: 0,
      end: 10,
    });

    expect(result).toEqual([]);
  });

  it('never produces an inverted range', () => {
    const marks = [rangedMark(0, 5), rangedMark(3, 12), rangedMark(8, 25)];
    const result = splitMarks({ marks, start: 10, end: 20 });

    for (const mark of result ?? []) {
      expect(mark.attrs?.start).toBeLessThanOrEqual(mark.attrs?.end ?? 0);
    }
  });

  it('clamps a partially overlapping mark to the segment', () => {
    const result = splitMarks({
      marks: [rangedMark(5, 15)],
      start: 10,
      end: 20,
    });

    expect(result).toEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({ start: 10, end: 15 }),
      }),
    ]);
  });

  it('clamps a mark that contains the segment to the segment bounds', () => {
    const result = splitMarks({
      marks: [rangedMark(0, 30)],
      start: 10,
      end: 20,
    });

    expect(result).toEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({ start: 10, end: 20 }),
      }),
    ]);
  });

  it('keeps positionless marks on every segment without injecting attrs', () => {
    const first = splitMarks({
      marks: [positionlessMark],
      start: 0,
      end: 10,
    });
    const second = splitMarks({
      marks: [positionlessMark],
      start: 10,
      end: 20,
    });

    expect(first).toEqual([positionlessMark]);
    expect(second).toEqual([positionlessMark]);
    expect(first?.[0].attrs).not.toHaveProperty('start');
    expect(first?.[0].attrs).not.toHaveProperty('end');
  });

  it('attaches a zero-width mark to the segment that starts at its position', () => {
    const zeroWidth = rangedMark(10, 10);

    const before = splitMarks({ marks: [zeroWidth], start: 0, end: 10 });
    const after = splitMarks({ marks: [zeroWidth], start: 10, end: 20 });

    expect(before).toEqual([]);
    expect(after).toHaveLength(1);
  });

  it('attaches a zero-width mark at the node end only to the last segment', () => {
    const zeroWidth = rangedMark(20, 20);

    const notLast = splitMarks({ marks: [zeroWidth], start: 10, end: 20 });
    const last = splitMarks({
      marks: [zeroWidth],
      start: 10,
      end: 20,
      isLast: true,
    });

    expect(notLast).toEqual([]);
    expect(last).toHaveLength(1);
  });

  it('does not mutate the input marks', () => {
    const mark = rangedMark(5, 15);
    const original = JSON.parse(JSON.stringify(mark));

    splitMarks({ marks: [mark], start: 10, end: 20 });

    expect(mark).toEqual(original);
  });
});
