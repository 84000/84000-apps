import {
  compareIgnoringArticles,
  compareToh,
  escapeHtml,
  escapeHtmlAttribute,
  parseToh,
  stripLeadingArticles,
} from './string';

describe('parseToh', () => {
  it('formats a single toh', () => {
    expect(parseToh('toh417')).toBe('Toh 417');
  });

  it('formats a comma-separated list', () => {
    expect(parseToh('toh417,toh418')).toBe('Toh 417, Toh 418');
  });
});

describe('compareToh', () => {
  const sorted = (tohs: string[]) => [...tohs].sort(compareToh);

  it('orders by numeric value, not string value', () => {
    expect(sorted(['toh1206', 'toh12', 'toh95', 'toh1'])).toEqual([
      'toh1',
      'toh12',
      'toh95',
      'toh1206',
    ]);
  });

  it('uses the value after a dash only when the value before it ties', () => {
    expect(sorted(['toh12', 'toh1-2', 'toh1-10', 'toh1', 'toh2'])).toEqual([
      'toh1',
      'toh1-2',
      'toh1-10',
      'toh2',
      'toh12',
    ]);
  });

  it('orders letter suffixes after the bare number', () => {
    expect(sorted(['toh1006b', 'toh1007', 'toh1006', 'toh1006a'])).toEqual([
      'toh1006',
      'toh1006a',
      'toh1006b',
      'toh1007',
    ]);
  });

  it('orders a list of tohs by its first entry', () => {
    expect(sorted(['toh12 toh3', 'toh2 toh100'])).toEqual([
      'toh2 toh100',
      'toh12 toh3',
    ]);
  });

  it('sorts an empty toh first', () => {
    expect(sorted(['toh1', ''])).toEqual(['', 'toh1']);
  });
});

describe('stripLeadingArticles', () => {
  it('strips leading articles', () => {
    expect(stripLeadingArticles('The Play in Full')).toBe('Play in Full');
    expect(stripLeadingArticles('A Multitude of Buddhas')).toBe(
      'Multitude of Buddhas',
    );
    expect(stripLeadingArticles('An Analysis of Action')).toBe(
      'Analysis of Action',
    );
    expect(stripLeadingArticles('And So It Was')).toBe('So It Was');
  });

  it('is case-insensitive', () => {
    expect(stripLeadingArticles('the play in full')).toBe('play in full');
  });

  it('only strips whole words at the start', () => {
    expect(stripLeadingArticles('Analysis of Action')).toBe(
      'Analysis of Action',
    );
    expect(stripLeadingArticles('Theft of the Jewel')).toBe(
      'Theft of the Jewel',
    );
    expect(stripLeadingArticles('Play in Full, The')).toBe(
      'Play in Full, The',
    );
  });
});

describe('compareIgnoringArticles', () => {
  it('sorts as if leading articles were absent', () => {
    const titles = [
      'The Zebra Sutra',
      'A Banana Sutra',
      'Candle Sutra',
      'The Apple Sutra',
    ];
    expect([...titles].sort(compareIgnoringArticles)).toEqual([
      'The Apple Sutra',
      'A Banana Sutra',
      'Candle Sutra',
      'The Zebra Sutra',
    ]);
  });

  it('ignores case and diacritics', () => {
    expect(compareIgnoringArticles('āpple', 'Apple')).toBe(0);
  });
});

describe('escapeHtml', () => {
  it('escapes the characters that break out of a text node', () => {
    expect(escapeHtml('<b>a & b</b>')).toBe('&lt;b&gt;a &amp; b&lt;/b&gt;');
  });

  it('escapes ampersands before the entities it introduces', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves quotes alone, since a text node may hold them', () => {
    expect(escapeHtml('say "hi"')).toBe('say "hi"');
  });

  it('passes plain text through unchanged', () => {
    expect(escapeHtml('oṃ | āḥ hūṃ')).toBe('oṃ | āḥ hūṃ');
  });
});

describe('escapeHtmlAttribute', () => {
  it('escapes double quotes as well', () => {
    expect(escapeHtmlAttribute('say "hi" & <bye>')).toBe(
      'say &quot;hi&quot; &amp; &lt;bye&gt;',
    );
  });
});
