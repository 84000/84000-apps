import { normalizeToh, tohNoteMentions } from './toh';

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
  ])('normalizes %s to %s', (input, expected) => {
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
    ['312a', 'a suffixed catalogue entry'],
    ['toh312a', 'a suffixed catalogue entry with prefix'],
    ['312-313', 'a range'],
    ['3 1 2', 'internal whitespace'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeToh(input)).toBeUndefined();
  });

  it('rejects nullish input', () => {
    expect(normalizeToh(undefined)).toBeUndefined();
    expect(normalizeToh(null)).toBeUndefined();
  });
});

describe('tohNoteMentions', () => {
  it('matches the number written on its own', () => {
    expect(tohNoteMentions('Toh 418', 'toh418')).toBe(true);
    expect(tohNoteMentions('also cited as 418', 'toh418')).toBe(true);
    expect(tohNoteMentions('417, 418', 'toh418')).toBe(true);
  });

  it('does not match a number that merely contains the digits', () => {
    expect(tohNoteMentions('Toh 1418', 'toh418')).toBe(false);
    expect(tohNoteMentions('Toh 4180', 'toh418')).toBe(false);
    expect(tohNoteMentions('Toh 14180', 'toh418')).toBe(false);
  });

  it('returns false for an absent note', () => {
    expect(tohNoteMentions(null, 'toh418')).toBe(false);
    expect(tohNoteMentions(undefined, 'toh418')).toBe(false);
    expect(tohNoteMentions('', 'toh418')).toBe(false);
  });
});
