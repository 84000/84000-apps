import { reanchorText } from './reanchor';

describe('reanchorText', () => {
  const content = 'The Buddha said. the buddha left. The Bud­dha  returned.';

  it('prefers an exact-case occurrence', () => {
    expect(reanchorText({ content, text: 'buddha' })).toEqual({
      start: 21,
      end: 27,
    });
  });

  it('falls back to a case-insensitive match', () => {
    expect(reanchorText({ content, text: 'BUDDHA said' })).toEqual({
      start: 4,
      end: 15,
    });
  });

  it('ignores soft hyphens and runs of whitespace', () => {
    const range = reanchorText({ content, text: 'Buddha returned' });
    expect(range).not.toBeNull();
    expect(range && content.slice(range.start, range.end)).toBe(
      'Bud­dha  returned',
    );
  });

  it('takes the requested occurrence, or the one nearest an offset', () => {
    expect(reanchorText({ content, text: 'Buddha', occurrence: 2 })).toEqual({
      start: 38,
      end: 45,
    });
    expect(reanchorText({ content, text: 'Buddha', occurrence: 3 })).toBeNull();
    expect(reanchorText({ content, text: 'Buddha', near: 40 })?.start).toBe(38);
  });

  it('returns null when the text is not there', () => {
    expect(reanchorText({ content, text: 'Dharma' })).toBeNull();
    expect(reanchorText({ content, text: '  ' })).toBeNull();
  });
});
