import {
  htmlToText,
  normalizeText,
  normalizeTibetan,
  SOFT_HYPHEN,
  tsvRow,
} from './normalize';

describe('normalizeText', () => {
  it('strips soft hyphens so a name greps as typed', () => {
    const stored = `Samanta${SOFT_HYPHEN}bhadra and Mañju${SOFT_HYPHEN}śrī`;
    expect(normalizeText(stored)).toBe('Samantabhadra and Mañjuśrī');
    expect(normalizeText(stored)).toContain('Samantabhadra');
  });

  it('keeps every other character, including diacritics and invisible ones', () => {
    const text =
      'Śākyamuni\u00A0said: “ṛddhi” — ཆོས་བཟང་ zero\u200Dwidth  double  space ';
    expect(normalizeText(text)).toBe(text);
  });

  it('replaces each line break and tab with exactly one space', () => {
    expect(normalizeText('a\nb\r\nc\td')).toBe('a b  c d');
    expect(normalizeText('a\nb\r\nc\td')).toHaveLength('a\nb\r\nc\td'.length);
  });

  it('only shortens text by the soft hyphens it removes', () => {
    const stored = `x${SOFT_HYPHEN}y\nz${SOFT_HYPHEN}`;
    expect(normalizeText(stored).length).toBe(stored.length - 2);
  });

  it('treats null and undefined as empty', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('normalizeTibetan', () => {
  it('drops folio line breaks, which fall inside words', () => {
    expect(normalizeTibetan('ཐོས་\nཔ། །\r\nདེ་')).toBe('ཐོས་པ། །དེ་');
  });

  it('strips soft hyphens and keeps other characters', () => {
    expect(normalizeTibetan(`ཆོས་${SOFT_HYPHEN}བཟང་ [F.35.a]`)).toBe(
      'ཆོས་བཟང་ [F.35.a]',
    );
  });
});

describe('htmlToText', () => {
  it('drops tags, decodes entities and collapses whitespace', () => {
    expect(
      htmlToText(
        '<p class="def">A &amp; B\n  <i>&lt;c&gt;</i>&nbsp;&quot;d&#39;</p>',
      ),
    ).toBe('A & B <c> "d\'');
  });
});

describe('tsvRow', () => {
  it('never lets a value add a cell or a line', () => {
    const row = tsvRow(['a\tb', 'c\nd', null, 3]);
    expect(row.split('\t')).toEqual(['a b', 'c d', '', '3']);
    expect(row).not.toContain('\n');
  });
});
