/**
 * @jest-environment jsdom
 */
import { findHighlightRanges, highlightHTML, markClassName } from './highlight';

const marks = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('mark')].map((mark) => ({
    text: mark.textContent,
    active: mark.className === markClassName(true),
  }));
};

describe('findHighlightRanges', () => {
  it('matches a literal query case-insensitively', () => {
    expect(findHighlightRanges('Ab ab a.b', 'ab')).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 5 },
    ]);
    expect(findHighlightRanges('a.b axb', 'a.b')).toEqual([
      { start: 0, end: 3 },
    ]);
  });

  it('matches a pattern in regex mode, and nothing for an invalid one', () => {
    expect(findHighlightRanges('a.b axb', 'a.b', true)).toHaveLength(2);
    expect(findHighlightRanges('a(b', 'a(', true)).toEqual([]);
  });

  it('matches nothing for a blank query', () => {
    expect(findHighlightRanges('text', '  ')).toEqual([]);
  });
});

describe('highlightHTML', () => {
  const folio =
    '<span class="mention-container"><a class="mention-link" type="mention">[F.12.b]</a></span>';
  const note =
    '<sup class="end-note-link" type="endNoteLink" uuid="n1">⁠1</sup>';

  it('marks matches in the text, across inline formatting', () => {
    const html = highlightHTML({
      content: 'the Blessed One said',
      html: '<p>the Bles<em>sed</em> One said</p>',
      query: 'blessed',
    });

    expect(marks(html)).toEqual([
      { text: 'Bles', active: false },
      { text: 'sed', active: false },
    ]);
    expect(html).toContain('<em><mark');
  });

  it('keeps folio markers and endnote numbers as they are', () => {
    const html = highlightHTML({
      content: 'at F then 1 more',
      html: `<p>${folio}at F then 1${note} more</p>`,
      query: 'f',
    });

    expect(html).toContain('[F.12.b]</a>');
    expect(marks(html)).toEqual([{ text: 'F', active: false }]);
  });

  it('rings the active occurrence by its position among the matches', () => {
    const content = 'one sun, two suns';
    // The marker before the first match shifts every offset in the HTML.
    const html = highlightHTML({
      activeOccurrenceStart: content.lastIndexOf('sun'),
      content,
      html: `<p>${folio}one sun, two suns</p>`,
      query: 'sun',
    });

    expect(marks(html)).toEqual([
      { text: 'sun', active: false },
      { text: 'sun', active: true },
    ]);
  });

  it('rings nothing when the active offset is not a match', () => {
    const html = highlightHTML({
      activeOccurrenceStart: 1,
      content: 'sun',
      html: '<p>sun</p>',
      query: 'sun',
    });

    expect(marks(html)).toEqual([{ text: 'sun', active: false }]);
  });

  it('returns the HTML unchanged when nothing matches', () => {
    const html = '<p>nothing here</p>';
    expect(highlightHTML({ content: 'x', html, query: 'zzz' })).toBe(html);
  });
});
