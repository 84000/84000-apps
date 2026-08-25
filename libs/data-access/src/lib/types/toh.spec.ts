import { normalizeToh, tohNoteMentions } from './toh';

/**
 * The three notes in production's `work_toh`, verbatim — the entire population of
 * that column. Two use an en-dash, one a hyphen.
 */
const NOTES = {
  alias: 'toh418', // on toh417
  numericRange: 'Toh 1069-1073', // on toh1069
  letterRange: 'toh539a–d', // on toh539
} as const;

describe('normalizeToh', () => {
  it.each([
    ['toh312', 'toh312'],
    ['Toh 312', 'toh312'],
    ['TOH312', 'toh312'],
    ['toh 312', 'toh312'],
    ['T.312', 'toh312'],
    ['T. 312', 'toh312'],
    ['Toh.312', 'toh312'],
    ['312', 'toh312'],
    ['  312  ', 'toh312'],
  ])('normalizes the plain form %s to %s', (input, expected) => {
    expect(normalizeToh(input)).toBe(expected);
  });

  it.each([
    ['toh1-1', 'toh1-1'],
    ['Toh 1-13', 'toh1-13'],
    ['1-1', 'toh1-1'],
    ['toh1-01', 'toh1-1'],
  ])('keeps the subdivision form %s as %s', (input, expected) => {
    // 82 entries in production look like this; rejecting them reported real
    // works as nonexistent.
    expect(normalizeToh(input)).toBe(expected);
  });

  it.each([
    ['toh1059a', 'toh1059a'],
    ['Toh 1599b', 'toh1599b'],
    ['TOH539E', 'toh539e'],
    ['539f', 'toh539f'],
  ])('keeps the lettered form %s as %s', (input, expected) => {
    expect(normalizeToh(input)).toBe(expected);
  });

  it('strips leading zeros so padded and unpadded forms agree', () => {
    expect(normalizeToh('toh0312')).toBe('toh312');
    expect(normalizeToh('0312')).toBe('toh312');
  });

  it.each([
    ['', 'empty'],
    ['toh', 'prefix with no number'],
    ['Kangyur', 'not a number at all'],
    ['539a-d', 'a lettered range, which cites several works'],
    ['toh312ab', 'two letters'],
    ['3 1 2', 'internal whitespace'],
    ['toh-1', 'no leading number'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeToh(input)).toBeUndefined();
  });

  it('rejects nullish input', () => {
    expect(normalizeToh(undefined)).toBeUndefined();
    expect(normalizeToh(null)).toBeUndefined();
  });
});

describe('tohNoteMentions', () => {
  describe('a bare alternate number', () => {
    it('matches the number the note names', () => {
      expect(tohNoteMentions(NOTES.alias, 'toh418')).toBe(true);
    });

    it('does not match a number that merely contains the digits', () => {
      expect(tohNoteMentions('Toh 1418', 'toh418')).toBe(false);
      expect(tohNoteMentions('Toh 4180', 'toh418')).toBe(false);
    });

    it('does not let a plain number match a lettered entry', () => {
      expect(tohNoteMentions('toh418a', 'toh418')).toBe(false);
    });
  });

  describe('a numeric range', () => {
    it.each(['toh1069', 'toh1070', 'toh1071', 'toh1072', 'toh1073'])(
      'covers %s',
      (toh) => {
        // toh1070-toh1073 are absent from work_toh, so this note means the entry
        // covers the span rather than naming a subdivision.
        expect(tohNoteMentions(NOTES.numericRange, toh as never)).toBe(true);
      },
    );

    it.each(['toh1068', 'toh1074', 'toh106', 'toh10690'])(
      'does not cover %s',
      (toh) => {
        expect(tohNoteMentions(NOTES.numericRange, toh as never)).toBe(false);
      },
    );

    it('reads a subdivision label as a label, not a one-wide span', () => {
      // "toh1-1" is how the catalogue writes a subdivision; treating the hyphen
      // as a range would make it answer for toh1.
      expect(tohNoteMentions('toh1-1', 'toh1')).toBe(false);
    });
  });

  describe('a lettered range', () => {
    it.each(['toh539a', 'toh539b', 'toh539c', 'toh539d'])(
      'covers %s',
      (toh) => {
        expect(tohNoteMentions(NOTES.letterRange, toh as never)).toBe(true);
      },
    );

    it.each(['toh539e', 'toh539f', 'toh540a'])(
      'does not cover %s, which is a separate entry',
      (toh) => {
        // toh539e and toh539f are catalogued to different works entirely.
        expect(tohNoteMentions(NOTES.letterRange, toh as never)).toBe(false);
      },
    );

    it('does not answer for the base number itself', () => {
      // toh539 is its own entry, so it never reaches the note path anyway.
      expect(tohNoteMentions(NOTES.letterRange, 'toh539')).toBe(false);
    });

    it('accepts a hyphen as well as an en-dash', () => {
      expect(tohNoteMentions('toh539a-d', 'toh539c' as never)).toBe(true);
    });
  });

  it('returns false for an absent note', () => {
    expect(tohNoteMentions(null, 'toh418')).toBe(false);
    expect(tohNoteMentions(undefined, 'toh418')).toBe(false);
    expect(tohNoteMentions('', 'toh418')).toBe(false);
  });
});
