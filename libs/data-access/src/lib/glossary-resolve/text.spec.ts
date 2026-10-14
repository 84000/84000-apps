import {
  contextOf,
  normalizeForm,
  searchablePosition,
  searchableText,
  stableHash,
  storedRange,
} from './text';

describe('searchableText', () => {
  it('drops soft hyphens and zero-width characters and maps back to stored offsets', () => {
    const content = 'bo­dhi‍sattva x';
    const s = searchableText(content);
    expect(s.text).toBe('bodhisattva x');
    expect(storedRange(s, 0, 11)).toEqual({ start: 0, end: 13 });
    expect(content.slice(0, 13).replace(/[­‍]/g, '')).toBe('bodhisattva');
  });

  it('leaves an ignorable character after a match outside it', () => {
    const s = searchableText('power‍—x');
    expect(storedRange(s, 0, 5)).toEqual({ start: 0, end: 5 });
  });

  it('maps a stored offset forward past removed characters', () => {
    const s = searchableText('a­b');
    expect(searchablePosition(s, 1)).toBe(1);
    expect(searchablePosition(s, 2)).toBe(1);
    expect(searchablePosition(s, 3)).toBe(2);
  });
});

describe('normalizeForm', () => {
  it('removes ignorable characters and collapses whitespace', () => {
    expect(normalizeForm('  five­  aggre​gates ')).toBe('five aggregates');
  });
});

describe('contextOf', () => {
  it('brackets the match on one line', () => {
    expect(contextOf('one\ntwo three', 4, 7, 4)).toBe('one [[two]] thr…');
  });
});

describe('stableHash', () => {
  it('is stable and 16 hex digits', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).toMatch(/^[0-9a-f]{16}$/);
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
  });
});
