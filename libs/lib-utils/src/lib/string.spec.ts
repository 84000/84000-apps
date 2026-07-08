import {
  compareIgnoringArticles,
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
