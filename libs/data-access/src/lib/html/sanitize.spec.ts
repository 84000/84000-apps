import {
  BIBLIOGRAPHY_ALLOWLIST,
  GLOSSARY_DEFINITION_ALLOWLIST,
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

describe('BIBLIOGRAPHY_ALLOWLIST', () => {
  const bibliography = (html: string) =>
    sanitizeHtml({ html, allowlist: BIBLIOGRAPHY_ALLOWLIST, trim: false });

  // What the editor's inline marks render, one per mark.
  it.each([
    ['emphasis', '<p><em>Title</em>, <strong>bold</strong>, <u>under</u></p>'],
    ['sub and superscript', '<p>H<sub>2</sub>O<sup>1</sup></p>'],
    [
      'mark attributes',
      '<p><em data-type="title" data-text-style="foreign" data-lang="bo" uuid="m1">t</em></p>',
    ],
    ['small caps', '<p><sm class="uppercase">bce</sm></p>'],
    [
      'foreign text',
      '<p><span uuid="f1" type="span" textstyle="foreign" lang="bo" data-text-style="foreign">chos</span></p>',
    ],
    [
      'a link',
      '<p><a href="https://84000.co" target="_blank" rel="noreferrer noopener" type="link" uuid="l1">site</a></p>',
    ],
    [
      'an internal link',
      '<p><a class="link" type="internalLink" data-toh="toh1" entity="e1" entity-type="passage" uuid="i1" data-same-work="true" data-subtype="x" data-link-toh="toh2" href="/toh2">1.2</a></p>',
    ],
    [
      'a glossary instance',
      '<p><span class="glossary-instance" type="glossaryInstance" authority="a1" glossary="g1" uuid="gi1">term</span></p>',
    ],
    [
      'a comment mark',
      '<p><span class="comment-mark" type="comment" comment="c1" uuid="cm1">noted</span></p>',
    ],
    [
      'a mention',
      '<p><span data-type="mention" data-items="[{&quot;entity&quot;:&quot;e1&quot;}]" class="mention-container" data-toh="toh1">' +
        '<a class="mention-link" data-toh="toh1" lang="bo" data-style="quote" type="mention" uuid="m1" entity="e1" entity-type="passage" href="#" data-same-work="true" data-subtype="x" data-link-toh="toh1" data-highlight-start="0" data-highlight-end="4">1.2</a>' +
        '<span class="mention-link" data-style="quote">plain</span></span></p>',
    ],
    ['a line break', '<p>One<br />Two</p>'],
  ])('keeps %s', (_name, html) => {
    expect(bibliography(html)).toBe(html);
  });

  it('keeps whitespace and soft hyphens', () => {
    expect(bibliography(' <p>Bu\u00ADddha</p>\n')).toBe(
      ' <p>Bu\u00ADddha</p>\n',
    );
  });

  it('drops scripts, handlers and script links', () => {
    expect(
      bibliography(
        '<p onclick="x()">One<script>bad()</script><img src="x" onerror="y()" />' +
          '<a href="javascript:alert(1)">two</a><span style="color:red" onmouseover="z()">three</span></p>',
      ),
    ).toBe('<p>One<a>two</a><span>three</span></p>');
  });

  it('unwraps markup outside the inline set', () => {
    expect(bibliography('<p><font>old</font> <mark>new</mark></p>')).toBe(
      '<p>old new</p>',
    );
  });
});

describe('GLOSSARY_DEFINITION_ALLOWLIST', () => {
  const definition = (html: string) =>
    sanitizeHtml({
      html,
      allowlist: GLOSSARY_DEFINITION_ALLOWLIST,
      trim: false,
    });

  it.each([
    [
      'converted TEI',
      '<p class="paragraph">See <tei:foreign xml:lang="Sa-Ltn">karman</tei:foreign>, ' +
        '<term rend="bold" ref="x">las</term>, <hi rend="italic">this</hi> and ' +
        '<ref target="http://read.84000.co/translation/toh6.html" rend="pending" inst="link">Toh 6</ref>.</p>',
    ],
    [
      'notes and divisions',
      '<div type="section" place="end"><note type="definition" rend="x">A note</note>' +
        '<cite xml:lang="Bo-Ltn" class="c">mdo</cite> <title xml:lang="en">Sūtra</title></div>',
    ],
    [
      'pointers and pending references',
      '<p><span class="ref-pending" data-href="/entity/work/1" data-glossary-id="g" data-ref="r" data-inst="i">ref</span> ' +
        '<a href="/entity/passage/1" title="t" data-pointer-type="passage" data-pointer-target="p">here</a>' +
        '<ptr target="#x"></ptr></p>',
    ],
    [
      "the editor's inline marks",
      '<p><strong>b</strong> <u>u</u> <sub>s</sub> <sup>t</sup> <span class="foreign" lang="Sa-Ltn" data-type="foreign">k</span></p>',
    ],
  ])('keeps %s', (_name, html) => {
    expect(definition(html)).toBe(html);
  });

  it('reads a self-closing element as empty, not as wrapping what follows', () => {
    expect(
      definition(
        '<p>See <a href="/entity/passage/1"/> and <ref target="x"/> after.</p>',
      ),
    ).toBe(
      '<p>See <a href="/entity/passage/1"></a> and <ref target="x"></ref> after.</p>',
    );
  });

  it('drops scripts, handlers and script links', () => {
    expect(
      definition(
        '<p onclick="x()">One<script>bad()</script>' +
          '<a href="javascript:alert(1)">two</a><ref target="javascript:x()">three</ref>' +
          '<span data-href="javascript:y()">four</span></p>',
      ),
    ).toBe('<p>One<a>two</a><ref>three</ref><span>four</span></p>');
  });

  it('leaves other fields parsing self-closing elements as HTML', () => {
    expect(
      sanitizeHtml({
        html: '<p>A<br/>B</p>',
        allowlist: BIBLIOGRAPHY_ALLOWLIST,
      }),
    ).toBe('<p>A<br />B</p>');
  });
});
