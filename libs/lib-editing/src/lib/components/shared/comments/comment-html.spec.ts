import { commentHtmlFromText, commentTextFromHtml } from './comment-html';

describe('commentHtmlFromText', () => {
  it('makes a paragraph of a block of text', () => {
    expect(commentHtmlFromText('A note')).toBe('<p>A note</p>');
  });

  it('starts a paragraph at a blank line and breaks at a single newline', () => {
    expect(commentHtmlFromText('One\ntwo\n\nThree')).toBe(
      '<p>One<br />two</p><p>Three</p>',
    );
  });

  it('escapes what someone typed rather than reading it as markup', () => {
    expect(commentHtmlFromText('Compare a < b & "c"')).toBe(
      '<p>Compare a &lt; b &amp; &quot;c&quot;</p>',
    );
    expect(commentHtmlFromText('<script>steal()</script>')).toBe(
      '<p>&lt;script&gt;steal()&lt;/script&gt;</p>',
    );
  });

  it('drops blank blocks rather than making empty paragraphs', () => {
    expect(commentHtmlFromText('One\n\n\n\nTwo')).toBe('<p>One</p><p>Two</p>');
    expect(commentHtmlFromText('   ')).toBe('');
  });

  it('treats a windows line ending as a line ending', () => {
    expect(commentHtmlFromText('One\r\n\r\nTwo')).toBe('<p>One</p><p>Two</p>');
  });
});

describe('commentTextFromHtml', () => {
  it('reads a fragment back as the text that made it', () => {
    expect(commentTextFromHtml('<p>One<br />two</p><p>Three</p>')).toBe(
      'One\ntwo\n\nThree',
    );
  });

  it('unescapes, so editing shows what was typed', () => {
    expect(commentTextFromHtml('<p>Compare a &lt; b</p>')).toBe(
      'Compare a < b',
    );
  });

  it('round-trips, which is what stops an edit corrupting a comment', () => {
    const typed = 'First line\nsecond line\n\nA new paragraph with a < in it';

    expect(commentTextFromHtml(commentHtmlFromText(typed))).toBe(typed);
  });

  it('reads a bare body, which is what a client that sent no markup stored', () => {
    expect(commentTextFromHtml('Just text')).toBe('Just text');
  });

  it('needs no document, so the server cannot get a different answer', () => {
    // A fallback here would put markup in the textarea, and the next save would
    // escape it into the body for good.
    const doc = global.document;
    try {
      // @ts-expect-error -- standing in for a server render
      delete global.document;
      expect(commentTextFromHtml('<p>One<br />two</p>')).toBe('One\ntwo');
    } finally {
      global.document = doc;
    }
  });

  it('unescapes last, so an escaped tag someone typed stays text', () => {
    expect(commentTextFromHtml('<p>&lt;br /&gt; is a tag</p>')).toBe(
      '<br /> is a tag',
    );
  });

  it('is empty for an empty fragment', () => {
    expect(commentTextFromHtml('')).toBe('');
  });
});
