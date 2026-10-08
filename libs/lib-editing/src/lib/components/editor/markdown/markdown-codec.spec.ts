import { MarkdownManager } from '@tiptap/markdown';
import { getSchema, type JSONContent } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import {
  checkMarkdownRoundTrip,
  type EncoderTarget,
  markdownFormatOf,
  hasMarkdownChanges,
  parseMarkdown,
  serializeMarkdown,
} from './markdown-codec';
import { createMarkdownExtensions } from './markdown-extensions';

const t = (text: string, marks?: string[]): JSONContent => ({
  type: 'text',
  text,
  ...(marks && { marks: marks.map((type) => ({ type })) }),
});
const node = (type: string, content: JSONContent[] = [], attrs?: object) => ({
  type,
  ...(attrs && { attrs }),
  ...(content.length && { content }),
});
const p = (...content: JSONContent[]) => node('paragraph', content);
const doc = (...content: JSONContent[]) => node('doc', content);
const link = (text: string, href: string): JSONContent => ({
  type: 'text',
  text,
  marks: [{ type: 'link', attrs: { href } }],
});

describe('markdown codec', () => {
  it('parses the subset into its nodes', () => {
    const doc = parseMarkdown(
      '# T\n\n> q\n\n- a\n\n| x | y |\n| --- | --- |\n| 1 | 2 |\n\n[l](https://e.co)\n',
    );
    expect(doc.content?.map((node) => node.type)).toEqual([
      'heading',
      'blockquote',
      'bulletList',
      'table',
      'paragraph',
    ]);
  });

  it('keeps the source end-of-file newlines and CRLF line endings', () => {
    expect(markdownFormatOf('a\n\n')).toMatchObject({
      endOfFile: '\n\n',
      lineEnding: '\n',
    });
    expect(markdownFormatOf('a')).toMatchObject({
      endOfFile: '',
      lineEnding: '\n',
    });
    expect(markdownFormatOf('a\r\nb\r\n')).toMatchObject({
      endOfFile: '\n',
      lineEnding: '\r\n',
    });
    // Mixed endings are not CRLF, so they cannot round-trip.
    expect(markdownFormatOf('a\r\nb\n').lineEnding).toBe('\n');

    for (const source of ['a\n', 'a', 'a\n\n', 'a\r\nb\r\n']) {
      expect(checkMarkdownRoundTrip(source)).toMatchObject({ ok: true });
    }
  });

  it('sends irregular line endings to raw, never to rich', () => {
    for (const source of ['a\r\nb\n', 'a\rb\n', 'a\r\nb\r']) {
      expect(checkMarkdownRoundTrip(source)).toMatchObject({
        ok: false,
        reason: 'line-endings',
      });
    }
  });

  it('round-trips an empty source, one that is only newlines, and a BOM', () => {
    for (const source of ['', '\n', '\n\n\n', '\uFEFF# Title\n']) {
      expect(checkMarkdownRoundTrip(source)).toMatchObject({
        ok: true,
        serialized: source,
      });
    }
    // The BOM is not content: the heading still parses as one.
    expect(parseMarkdown('\uFEFF# Title').content?.[0].type).toBe('heading');
  });

  it('keeps empty paragraphs, writing &nbsp; for consecutive ones', () => {
    const p = (text?: string): JSONContent =>
      text
        ? { type: 'paragraph', content: [{ type: 'text', text }] }
        : { type: 'paragraph' };
    const doc = { type: 'doc', content: [p('a'), p(), p(), p('b')] };
    const { markdown } = serializeMarkdown(doc);
    expect(markdown).toBe('a\n\n\n\n&nbsp;\n\nb');
    expect(parseMarkdown(markdown).content).toEqual(doc.content);
    expect(checkMarkdownRoundTrip('a\n\n\n\nb\n').ok).toBe(true);
  });

  it('does not write trailing empty paragraphs, e.g. Enter twice at the end', () => {
    const typed = doc(p(t('a')), p(), p());
    expect(serializeMarkdown(typed)).toEqual({ markdown: 'a', exact: true });
    expect(serializeMarkdown(typed, { endOfFile: '\n' })).toEqual({
      markdown: 'a\n',
      exact: true,
    });
    // A document of only empty paragraphs is still one empty paragraph.
    expect(serializeMarkdown(doc(p(), p()))).toEqual({
      markdown: '',
      exact: true,
    });
  });

  it('names irregular line endings even when the subset cannot hold it', () => {
    for (const source of [
      '- [ ] task\r\n\r\nplain line\n',
      '![i](x)\n\nfoo\r\n',
    ]) {
      expect(checkMarkdownRoundTrip(source)).toEqual({
        ok: false,
        reason: 'line-endings',
        serialized: null,
        doc: null,
      });
    }
  });

  it('falls back instead of throwing on what the subset cannot hold', () => {
    for (const source of ['![img](x)\n', '- [ ] task\n']) {
      expect(checkMarkdownRoundTrip(source)).toEqual({
        ok: false,
        reason: 'unsupported',
        serialized: null,
        doc: null,
      });
    }
    expect(() => parseMarkdown('![img](x)')).toThrow();
  });

  it('keeps soft line breaks inside a paragraph', () => {
    const source = 'one paragraph\nhard-wrapped\nover three lines\n';
    expect(checkMarkdownRoundTrip(source).ok).toBe(true);
  });

  it('does not escape a list number after another inline node', () => {
    const source = '*a* **b**x 1. y\n';
    expect(checkMarkdownRoundTrip(source).ok).toBe(true);
  });

  it('writes a plain ampersand as is but still escapes markup', () => {
    expect(checkMarkdownRoundTrip('Tibetan & Sanskrit\n').ok).toBe(true);
    const doc = parseMarkdown('x');
    const withText = (text: string) =>
      serializeMarkdown({ ...doc, content: [p(t(text))] }).markdown;
    expect(withText('<b> &amp; a > b')).toBe('&lt;b> &amp;amp; a > b');
    expect(withText('> not a quote')).toBe('&gt; not a quote');
  });

  it('is strict: anything not byte-identical fails', () => {
    const cases = [
      'Some _italic_.\n', // re-serialized as *italic*
      '* bullet\n', // re-serialized as -
      '| a | b |\n| - | - |\n| c | d |\n', // re-padded
      'Hello\\* there\n', // the escaped asterisk is lost
      'A &amp; B\n', // decoded to &
      'a\r\nb\n', // mixed line endings
      '1) first\n', // re-serialized as 1.
    ];
    for (const source of cases) {
      const result = checkMarkdownRoundTrip(source);
      expect(result.ok).toBe(false);
      expect(result.serialized).not.toBe(source);
    }
  });

  it('keeps a number escaped only where upstream would start a list', () => {
    // Not after a paragraph's first character, so the source is kept as is.
    const source = '\\*a\\* x 10. y\n';
    expect(parseMarkdown(source).content).toEqual([p(t('*a* x 10. y'))]);
    expect(checkMarkdownRoundTrip(source)).toMatchObject({
      ok: true,
      serialized: source,
    });
  });

  it('gates saves on a byte-level change', () => {
    const source = '# Title\n\nBody.\n';
    const result = checkMarkdownRoundTrip(source);
    if (!result.ok) {
      throw new Error(`${source} does not round-trip: ${result.reason}`);
    }
    const { serialized } = result;
    expect(hasMarkdownChanges(serialized, source)).toBe(false);
    expect(hasMarkdownChanges(`${serialized} `, source)).toBe(true);
    expect(hasMarkdownChanges(serialized.replace(/\n/g, '\r\n'), source)).toBe(
      true,
    );
  });

  describe('typed literals', () => {
    const paragraph = (text: string) => doc(p(t(text)));

    it.each([
      '*x*',
      '_x_',
      '`x`',
      '[a](b)',
      '\\*',
      '# not a heading',
      '- not a list',
      '+ not a list',
      '1. not a list',
      '---',
      '~~x~~',
      'a | b',
      '&copy',
      '&copy;',
      '> not a quote',
    ])('%s stays literal text', (text) => {
      const typed = paragraph(text);
      const { markdown, exact } = serializeMarkdown(typed);
      expect(exact).toBe(true);
      expect(parseMarkdown(markdown).content).toEqual(typed.content);
    });

    it('escapes only when, and only the blocks where, it must', () => {
      const write = (...content: JSONContent[]) =>
        serializeMarkdown(doc(...content)).markdown;
      expect(write(p(t('2 * 3 and a_b')))).toBe('2 * 3 and a_b');
      expect(write(p(t('*x*')))).toBe('\\*x\\*');
      expect(write(p(t('a * b | c')), p(t('*x*')))).toBe(
        'a * b | c\n\n\\*x\\*',
      );
    });

    it('keeps a | inside a table cell', () => {
      const source = '| a \\| b | c   |\n| ------ | --- |\n| d      | e   |\n';
      const doc = parseMarkdown(source);
      const cell = doc.content?.[0].content?.[0].content?.[0];
      expect(cell?.content?.[0].content?.[0].text).toBe('a | b');
      expect(checkMarkdownRoundTrip(source).ok).toBe(true);
    });

    it('relies on a private encoder that still exists upstream', () => {
      const target = new MarkdownManager({
        extensions: [],
      }) as unknown as EncoderTarget;
      expect(typeof target.encodeTextForMarkdown).toBe('function');
      expect(target.codeTypes).toBeInstanceOf(Set);
    });
  });

  describe('exactness', () => {
    const schema = getSchema(createMarkdownExtensions());
    const h = (level: number, ...content: JSONContent[]) =>
      node('heading', content, { level });
    const item = (...content: JSONContent[]) =>
      node('listItem', [p(...content)]);
    const code = (text: string) =>
      node('codeBlock', [t(text)], { language: null });
    const cell = (...content: JSONContent[]) =>
      node('tableCell', [p(...content)]);
    const table = (...cells: JSONContent[]) =>
      node('table', [
        node('tableRow', [node('tableHeader', [p(t('h'))])]),
        node('tableRow', cells),
      ]);

    // Every shape the round-2 review found, and what is typed most often.
    // `true`: it round-trips. `false`: it has no exact markdown here.
    // A pair pins `{}` and `{ endOfFile: '\\n' }` separately.
    it.each<[string, JSONContent, boolean | readonly [boolean, boolean]]>([
      ['a bare URL', doc(p(t('see https://e.co now'))), true],
      ['a www. link', doc(p(t('see www.e.co'))), true],
      ['an email', doc(p(t('mail a@b.co'))), true],
      ['a heading ending in #', doc(h(1, t('C #'))), true],
      ['a heading ending in ##', doc(h(2, t('a ##'))), true],
      ['! before a link', doc(p(t('wow!'), link('x', 'y'))), true],
      ['\\ before bold', doc(p(t('a\\'), t('b', ['bold']))), true],
      ['\\ before a soft newline', doc(p(t('a\\\nb'))), true],
      [
        'typed markup in a list',
        doc(node('bulletList', [item(t('*x* [a](b)'))])),
        true,
      ],
      [
        'typed markup in a quote',
        doc(node('blockquote', [p(t('# _x_'))])),
        true,
      ],
      ['| in a table cell', doc(table(cell(t('a | *b*')))), true],
      [
        'marks',
        doc(
          p(
            t('a', ['bold']),
            t(' '),
            t('b', ['italic']),
            t(' '),
            t('c', ['code']),
          ),
        ),
        true,
      ],
      ['a code block', doc(code('x = *y*')), true],
      ['4 leading spaces', doc(p(t('    code'))), false],
      ['a leading tab', doc(p(t('\tcode'))), false],
      ['an empty blockquote', doc(p(t('a')), node('blockquote', [p()])), false],
      ['a backtick in inline code', doc(p(t('a`b', ['code']))), false],
      [
        '| in a table-cell code span',
        doc(table(cell(t('a|b', ['code'])))),
        false,
      ],
      ['a fence in a code block', doc(code('```\nx')), false],
      ['an href with a space', doc(p(link('x', 'a b'))), false],
      ['an href with )', doc(p(link('x', 'a)b'))), false],
      ['an NBSP-only paragraph', doc(p(t('\u00a0'))), false],
      ['an empty heading', doc(h(1)), false],
      [
        'an empty list item',
        doc(node('bulletList', [node('listItem', [p()])])),
        false,
      ],
      ['a trailing hard break', doc(p(t('a'), node('hardBreak'))), false],
      [
        'adjacent lists',
        doc(
          node('bulletList', [item(t('a'))]),
          node('bulletList', [item(t('b'))]),
        ),
        false,
      ],
      [
        'an ordered list from 0',
        doc(node('orderedList', [item(t('a'))], { start: 0 })),
        false,
      ],
      // Fine alone, but an end-of-file newline changes how they parse.
      ['a soft newline then a space', doc(p(t('a\n '))), [true, false]],
      ['a soft newline then a fence', doc(p(t('a\n```js'))), true],
      ['a soft newline then a ~~~ fence', doc(p(t('a\n~~~'))), true],
      ['a number ending a line', doc(p(t('x 10.'))), true],
      ['a number mid-paragraph', doc(p(t('x 10. y'))), true],
      // Upstream's ordered list starts after a paragraph's first character.
      ['a number after a letter', doc(p(t('A1. Scope'))), true],
      ['a number after a letter and a space', doc(p(t('x 1. y'))), true],
      ['a number right after a letter', doc(p(t('x10. y'))), true],
      ['a number after a parenthesis', doc(p(t('(1. a'))), true],
    ])('%s', (_, shape, expected) => {
      const [plain, withNewline] =
        typeof expected === 'boolean' ? [expected, expected] : expected;
      for (const [format, pinned] of [
        [{}, plain],
        [{ endOfFile: '\n' }, withNewline],
      ] as const) {
        const { markdown, exact } = serializeMarkdown(shape, format);
        let reparsed: PMNode | null = null;
        try {
          reparsed = PMNode.fromJSON(schema, parseMarkdown(markdown));
        } catch {
          // Unsupported on reload: not exact.
        }
        // Never exact when the reparse differs, and never the other way
        // round. Checked on the bytes as written, end-of-file newline and all.
        expect({ format, exact }).toEqual({
          format,
          exact: reparsed?.eq(PMNode.fromJSON(schema, shape)) ?? false,
        });
        expect({ format, exact }).toEqual({ format, exact: pinned });
      }
    });

    it('reports a document whose markdown throws on reparse as not exact', () => {
      const emptyItem = doc(
        node('orderedList', [node('listItem', [p()])], { start: 1 }),
      );
      expect(() => parseMarkdown('1. ')).toThrow();
      expect(serializeMarkdown(emptyItem)).toEqual({
        markdown: '1. ',
        exact: false,
      });
    });
  });

  it('does no markdown work until first used', () => {
    jest.isolateModules(() => {
      const actual = jest.requireActual('@tiptap/markdown');
      const create = jest.fn(
        (options: object) => new actual.MarkdownManager(options),
      );
      jest.doMock('@tiptap/markdown', () => ({
        ...actual,
        MarkdownManager: create,
      }));
      const codec: typeof import('./markdown-codec') = require('./markdown-codec');
      expect(create).not.toHaveBeenCalled();
      codec.parseMarkdown('a');
      codec.serializeMarkdown(codec.parseMarkdown('b'));
      expect(create).toHaveBeenCalledTimes(1);
    });
  });
});
