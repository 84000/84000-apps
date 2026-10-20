import { commentAnchorsInHtml, stripCommentMarks } from './comment-marks';

const mark = (comment: string, uuid: string, text: string) =>
  `<span class="comment-mark" type="comment" comment="${comment}" uuid="${uuid}">${text}</span>`;

describe('commentAnchorsInHtml', () => {
  it('finds nothing in a fragment without marks', () => {
    expect(commentAnchorsInHtml('<p>Conze, <em>Large Sutra</em></p>')).toEqual(
      [],
    );
  });

  it('places each mark by text offset', () => {
    const html = `<p>Conze, ${mark('t1', 'a1', '<em>Large</em> Sutra')}, 1975</p>`;

    expect(commentAnchorsInHtml(html)).toEqual([
      { uuid: 'a1', comment: 't1', start: 7, end: 18 },
    ]);
  });

  it('counts an entity as one character', () => {
    const html = `<p>A &amp; B ${mark('t1', 'a1', 'C')}</p>`;

    expect(commentAnchorsInHtml(html)).toEqual([
      { uuid: 'a1', comment: 't1', start: 6, end: 7 },
    ]);
  });

  it('keeps overlapping and nested marks apart, in document order', () => {
    const html = `<p>${mark('t1', 'a1', `one ${mark('t2', 'a2', 'two')}`)} three</p>`;

    expect(commentAnchorsInHtml(html)).toEqual([
      { uuid: 'a1', comment: 't1', start: 0, end: 7 },
      { uuid: 'a2', comment: 't2', start: 4, end: 7 },
    ]);
  });

  it('ignores spans that are not comment marks', () => {
    const html = `<p><span type="mention" data-items="[]">x</span>${mark('t1', 'a1', 'y')}</p>`;

    expect(commentAnchorsInHtml(html)).toEqual([
      { uuid: 'a1', comment: 't1', start: 1, end: 2 },
    ]);
  });
});

describe('stripCommentMarks', () => {
  it('leaves a fragment without marks unchanged', () => {
    const html = '<p><span lang="bo">x</span> commentary</p>';
    expect(stripCommentMarks(html)).toBe(html);
  });

  it('unwraps marks, keeping their text and the markup inside them', () => {
    const html = `<p>Conze, ${mark('t1', 'a1', '<em>Large</em> <span lang="sa">Sutra</span>')}</p>`;

    expect(stripCommentMarks(html)).toBe(
      '<p>Conze, <em>Large</em> <span lang="sa">Sutra</span></p>',
    );
  });

  it('unwraps nested and adjacent marks', () => {
    const html = `<p>${mark('t1', 'a1', `a ${mark('t2', 'a2', 'b')}`)}${mark('t1', 'a3', 'c')}</p>`;

    expect(stripCommentMarks(html)).toBe('<p>a bc</p>');
  });

  it('reads a quoted attribute holding a closing bracket', () => {
    const html = `<p><a href="/x?a>b">${mark('t1', 'a1', 'y')}</a></p>`;

    expect(stripCommentMarks(html)).toBe('<p><a href="/x?a>b">y</a></p>');
  });
});
