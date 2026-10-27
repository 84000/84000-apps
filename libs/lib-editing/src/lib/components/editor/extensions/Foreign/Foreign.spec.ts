import { getSchema, type JSONContent } from '@tiptap/core';
import { DOMParser, DOMSerializer } from '@tiptap/pm/model';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';

import { translationSSRExtensions } from '../translationSSRExtensions';
import { renderableForeignLang } from './Foreign';

const schema = getSchema(translationSSRExtensions);

const para = (lang?: string): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'vajrapada',
          marks: [
            {
              type: 'foreign',
              attrs: {
                uuid: 'f-1',
                textStyle: 'foreign',
                ...(lang === undefined ? {} : { lang }),
              },
            },
          ],
        },
      ],
    },
  ],
});

/** The span as the editor's DOM serializer builds it. */
const editorSpan = (lang?: string) => {
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
    schema.nodeFromJSON(para(lang)).content,
  );
  const host = document.createElement('div');
  host.appendChild(fragment);
  return host.querySelector('span[data-text-style="foreign"]') as HTMLElement;
};

/** The span as the reader's static renderer builds it. */
const readerSpan = (lang?: string) => {
  const host = document.createElement('div');
  host.innerHTML = renderToHTMLString({
    content: para(lang),
    extensions: translationSSRExtensions,
  });
  return host.querySelector('span[data-text-style="foreign"]') as HTMLElement;
};

/** Pastes a span's HTML back into the schema, returning every mark it gets. */
const pasted = (lang?: string) =>
  DOMParser.fromSchema(schema).parse(
    editorSpan(lang).parentElement as HTMLElement,
  ).firstChild?.firstChild?.marks ?? [];

describe('renderableForeignLang', () => {
  it('passes a language tag through', () => {
    expect(renderableForeignLang('Sa-Ltn')).toBe('Sa-Ltn');
    expect(renderableForeignLang('bo')).toBe('bo');
  });

  it('drops the unspecified placeholder and empty values', () => {
    expect(renderableForeignLang('foreign')).toBeUndefined();
    expect(renderableForeignLang('')).toBeUndefined();
    expect(renderableForeignLang(undefined)).toBeUndefined();
    expect(renderableForeignLang(null)).toBeUndefined();
  });
});

describe('ForeignMark rendering', () => {
  describe.each([
    ['editor', editorSpan],
    ['reader', readerSpan],
  ])('in the %s', (_name, span) => {
    it('renders the lang of a foreign span that names a language', () => {
      const el = span('Sa-Ltn');
      expect(el.getAttribute('lang')).toBe('Sa-Ltn');
    });

    it('renders no lang attribute for a foreign span with no language', () => {
      const el = span();
      expect(el.hasAttribute('lang')).toBe(false);
      expect(el.textContent).toBe('vajrapada');
    });

    it('renders no lang attribute for the stored "foreign" placeholder', () => {
      expect(span('foreign').hasAttribute('lang')).toBe(false);
    });

    it('leaves the styling to the design system, with no inline style', () => {
      expect(span().hasAttribute('style')).toBe(false);
      expect(span('foreign').hasAttribute('style')).toBe(false);
    });
  });

  it('pastes a span rendered with no lang as the same foreign mark alone', () => {
    for (const lang of [undefined, 'foreign']) {
      const marks = pasted(lang);
      expect(marks.map((m) => m.type.name)).toEqual(['foreign']);
      expect(marks[0].attrs.lang).toBe('foreign');
    }
  });

  it('keeps a real language when a span is copied and pasted', () => {
    const marks = pasted('Bo-Ltn');
    expect(marks.map((m) => m.type.name)).toEqual(['foreign']);
    expect(marks[0].attrs.lang).toBe('Bo-Ltn');
  });
});
