import {
  estimateTokens,
  foldDiacritics,
  foldLine,
  freshnessLine,
  lineAt,
  lineStarts,
  normalizeSnapshotPath,
  normalizeWork,
} from './text';
import type { ReadyWorkSnapshot } from './source';

describe('normalizeSnapshotPath', () => {
  it.each([
    [undefined, ''],
    ['', ''],
    ['/', ''],
    ['./text/', 'text'],
    ['/text//04-translation', 'text/04-translation'],
    ['toh8/text', 'text'],
    ['toh8', ''],
  ])('%s -> %s', (path, expected) => {
    expect(normalizeSnapshotPath(path, 'toh8')).toBe(expected);
  });

  it('refuses a path that climbs out', () => {
    expect(normalizeSnapshotPath('text/../../etc', 'toh8')).toBeNull();
  });
});

describe('normalizeWork', () => {
  it.each([
    ['toh8', 'toh8'],
    ['Toh 8', 'toh8'],
    ['8', 'toh8'],
    ['TOH1-1', 'toh1-1'],
    ['539a', 'toh539a'],
    [
      '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d',
      '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d',
    ],
  ])('%s -> %s', (work, expected) => {
    expect(normalizeWork(work)).toBe(expected);
  });
});

describe('lineStarts and lineAt', () => {
  it('treats a trailing newline as ending the last line', () => {
    const text = 'a\nbb\n';
    const starts = lineStarts(text);
    expect(starts).toEqual([0, 2]);
    expect(lineAt(text, starts, 0)).toBe('a');
    expect(lineAt(text, starts, 1)).toBe('bb');
  });

  it('keeps a last line without a newline, and empty lines', () => {
    const text = 'a\n\nc';
    const starts = lineStarts(text);
    expect(starts.map((_, i) => lineAt(text, starts, i))).toEqual([
      'a',
      '',
      'c',
    ]);
  });

  it('has no lines for an empty file', () => {
    expect(lineStarts('')).toEqual([]);
  });
});

describe('foldDiacritics', () => {
  it('drops Latin diacritics', () => {
    expect(foldDiacritics('Mañjuśrī ṛṣi Ḍākinī')).toBe('Manjusri rsi Dakini');
  });

  it('keeps Tibetan vowel signs', () => {
    expect(foldDiacritics('བྱང་ཆུབ་སེམས')).toBe('བྱང་ཆུབ་སེམས');
  });

  it('keeps line breaks, so line numbers survive', () => {
    expect(foldDiacritics('ā\nī\n').split('\n')).toHaveLength(3);
  });
});

describe('foldLine', () => {
  const slice = (original: string, from: number, to: number) => {
    const line = foldLine(original);
    return original.slice(line.start(from), line.end(to));
  };

  it('folds as foldDiacritics does', () => {
    const line = 'the Mañjuśrī sūtra';
    expect(foldLine(line).text).toBe(foldDiacritics(line));
  });

  it('maps folded ranges back into the original', () => {
    const original = 'the Mañjuśrī sūtra';
    const { text } = foldLine(original);
    const name = text.indexOf('Manjusri');
    expect(slice(original, name, name + 8)).toBe('Mañjuśrī');
    const start = text.indexOf('sutra');
    expect(slice(original, start, text.length)).toBe('sūtra');
  });

  it('keeps marks folded off the last character of a match', () => {
    const original = 'a\u0304b';
    expect(foldLine(original).text).toBe('ab');
    expect(slice(original, 0, 1)).toBe(original.slice(0, 2));
  });

  it('maps ranges inside an unchanged Tibetan stack exactly', () => {
    const original = 'སྐྱེས་པ';
    expect(foldLine(original).text).toBe(original);
    expect(slice(original, 0, 2)).toBe('སྐ');
    expect(slice(original, 1, 3)).toBe('ྐྱ');
  });

  it('is the identity on ASCII', () => {
    const line = foldLine('plain');
    expect(line.text).toBe('plain');
    expect([line.start(3), line.end(3)]).toEqual([3, 3]);
  });
});

describe('estimateTokens', () => {
  it('counts ASCII at four characters a token and other characters as one', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('བྱང')).toBe(3);
  });
});

describe('freshnessLine', () => {
  const snapshot: ReadyWorkSnapshot = {
    status: 'ready',
    snapshotId: 'w/1',
    workUuid: 'w',
    root: 'toh8',
    generatedAt: '2026-10-13T10:00:00.000Z',
    current: true,
    draftChangedSince: false,
    ageMinutes: 12,
    refreshing: false,
    archiveBytes: 1,
    manifest: {},
    download: null,
  };

  it('says when the snapshot is current', () => {
    expect(freshnessLine(snapshot)).toBe(
      '[toh8 draft snapshot · generated 2026-10-13 10:00 UTC (12 min ago) · current]',
    );
  });

  it('says when the draft changed and a refresh is running', () => {
    expect(
      freshnessLine({
        ...snapshot,
        current: false,
        draftChangedSince: true,
        refreshing: true,
      }),
    ).toContain('behind the draft: edited since; a refresh is running');
  });

  it('formats a Postgres timestamp too', () => {
    expect(
      freshnessLine({
        ...snapshot,
        generatedAt: '2026-10-13 17:05:48.041+00:00',
      }),
    ).toContain('generated 2026-10-13 17:05 UTC');
  });

  it('says when the snapshot is only old', () => {
    expect(freshnessLine({ ...snapshot, current: false })).toContain(
      'older than a day',
    );
  });
});
