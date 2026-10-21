import type { DataClient } from '@eightyfourthousand/data-access';
import {
  bareToh,
  markAlignedSides,
  readAlignmentSpans,
  type AlignmentSpan,
} from './alignment-spans';

const span = (
  start: string,
  end: string,
  endCharacterPosition: number | null = 10,
): AlignmentSpan => ({
  uuid: `${start}-${end}`,
  passageUuid: null,
  startFolioUuid: start,
  endFolioUuid: end,
  endCharacterPosition,
});

describe('markAlignedSides', () => {
  const sides = ['a', 'b', 'c', 'd', 'e'];

  it('marks every side a span starts on, ends on or crosses', () => {
    expect(markAlignedSides(sides, [span('b', 'd')])).toEqual({
      aligned: [false, true, true, true, false],
      unplaced: 0,
    });
  });

  it('leaves out an end side the span reaches at character 0', () => {
    expect(markAlignedSides(sides, [span('a', 'b', 0)]).aligned).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    // A span on one side keeps it, whatever its end position.
    expect(markAlignedSides(sides, [span('c', 'c', 0)]).aligned[2]).toBe(true);
  });

  it('merges overlapping spans and tolerates a reversed one', () => {
    expect(
      markAlignedSides(sides, [span('a', 'b'), span('b', 'a'), span('e', 'e')])
        .aligned,
    ).toEqual([true, true, false, false, true]);
  });

  it('counts spans whose sides are not in the list', () => {
    expect(markAlignedSides(sides, [span('a', 'z'), span('y', 'b')])).toEqual({
      aligned: [false, false, false, false, false],
      unplaced: 2,
    });
  });
});

describe('readAlignmentSpans', () => {
  it('reads the bare Toh and drops alignments missing a side', async () => {
    const filters: [string, unknown][] = [];
    const rows = [
      {
        uuid: '1',
        passage_uuid: 'p1',
        start_folio_uuid: 'a',
        end_folio_uuid: 'b',
        end_character_position: 4,
      },
      {
        uuid: '2',
        passage_uuid: 'p2',
        start_folio_uuid: 'b',
        end_folio_uuid: null,
        end_character_position: null,
      },
    ];
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: () => builder,
      limit: async () => ({ data: rows, error: null }),
    };
    const client = { from: () => builder } as unknown as DataClient;

    await expect(readAlignmentSpans(client, 'toh312')).resolves.toEqual([
      {
        uuid: '1',
        passageUuid: 'p1',
        startFolioUuid: 'a',
        endFolioUuid: 'b',
        endCharacterPosition: 4,
      },
    ]);
    expect(filters).toEqual([['toh', '312']]);
  });

  it('strips only a leading toh', () => {
    expect(bareToh('toh1-14')).toBe('1-14');
    expect(bareToh('724a')).toBe('724a');
  });
});
