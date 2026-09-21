import {
  COMMENT_ALLOWLIST,
  htmlHasText,
  sanitizeHtml,
  type HtmlAllowlist,
} from './sanitize';

const clean = (html: string, allowlist: HtmlAllowlist = COMMENT_ALLOWLIST) =>
  sanitizeHtml({ html, allowlist });

describe('sanitizeHtml', () => {
  it('keeps what the field allows', () => {
    expect(clean('<p>One</p><p>Two<br />Three</p>')).toBe(
      '<p>One</p><p>Two<br />Three</p>',
    );
  });

  it('unwraps a disallowed element rather than eating what it held', () => {
    // Removing markup should never silently remove what someone wrote.
    expect(clean('<div><p>Kept</p></div>')).toBe('<p>Kept</p>');
    expect(clean('<em>Emphasis a comment cannot express</em>')).toBe(
      'Emphasis a comment cannot express',
    );
  });

  it('drops a script and everything in it', () => {
    expect(clean('<p>Before</p><script>alert(1)</script><p>After</p>')).toBe(
      '<p>Before</p><p>After</p>',
    );
  });

  it('drops an event handler attribute', () => {
    expect(clean('<p onerror="alert(1)">Text</p>')).toBe('<p>Text</p>');
  });

  it('drops a javascript: link, href and all', () => {
    // `a` is not on the comment allowlist, so the element goes and the text stays.
    expect(clean('<a href="javascript:alert(1)">Click</a>')).toBe('Click');
  });

  it('escapes a stray angle bracket rather than reading it as a tag', () => {
    expect(clean('<p>Compare a &lt; b</p>')).toBe('<p>Compare a &lt; b</p>');
  });

  it('is per field, not one global set', () => {
    // What glossary and bibliography will need: the same function, a wider list.
    const richer: HtmlAllowlist = {
      tags: ['p', 'em', 'a'],
      attributes: { a: ['href'] },
    };

    expect(
      clean('<p><em>Titles</em> and <a href="/x">links</a></p>', richer),
    ).toBe('<p><em>Titles</em> and <a href="/x">links</a></p>');
    // ...and the comment list still refuses them.
    expect(clean('<p><em>Titles</em></p>')).toBe('<p>Titles</p>');
  });

  it('trims the fragment', () => {
    expect(clean('  <p>Text</p>  ')).toBe('<p>Text</p>');
  });
});

describe('htmlHasText', () => {
  it.each([
    ['<p>Something</p>', true],
    ['<p></p>', false],
    ['<p>   </p>', false],
    ['<p>&nbsp;</p>', false],
    ['', false],
    ['<br />', false],
  ])('%s -> %s', (html, expected) => {
    expect(htmlHasText(html)).toBe(expected);
  });

  it('is false for a body that is nothing but markup we refuse', () => {
    // How a write of `<script>…</script>` is refused as empty rather than
    // stored blank.
    expect(htmlHasText(clean('<script>alert(1)</script>'))).toBe(false);
  });
});
