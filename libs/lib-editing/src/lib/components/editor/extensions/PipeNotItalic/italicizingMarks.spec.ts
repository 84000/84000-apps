import { isItalicizingMark } from './italicizingMarks';

describe('isItalicizingMark', () => {
  it('treats the italic mark and its em alias as italicising', () => {
    expect(isItalicizingMark('italic')).toBe(true);
    expect(isItalicizingMark('em')).toBe(true);
  });

  it('treats a mark rendering a transliteration lang as italicising', () => {
    // `foreign` and `mantra` carry no italic mark; the design system's
    // `[lang]:not(...)` rule is what italicises them.
    expect(isItalicizingMark('foreign', { lang: 'Sa-Ltn' })).toBe(true);
    expect(isItalicizingMark('foreign', { lang: 'Bo-Ltn' })).toBe(true);
    expect(isItalicizingMark('mantra', { lang: 'Sa-Ltn' })).toBe(true);
    expect(isItalicizingMark('foreign', { lang: 'foreign' })).toBe(true);
  });

  it('leaves the langs that rule excludes upright', () => {
    for (const lang of ['en', 'bo', 'ja', 'zh']) {
      expect(isItalicizingMark('foreign', { lang })).toBe(false);
    }
  });

  it('does not italicise marks with no lang and no italic', () => {
    expect(isItalicizingMark('bold')).toBe(false);
    expect(isItalicizingMark('smallCaps', {})).toBe(false);
    expect(isItalicizingMark('underline', { lang: undefined })).toBe(false);
  });
});
