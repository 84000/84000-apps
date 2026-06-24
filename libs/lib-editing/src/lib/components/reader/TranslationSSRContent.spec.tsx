import type { JSONContent, Extensions } from '@tiptap/core';
import type { ReactElement } from 'react';
import { TranslationSSRContent } from './TranslationSSRContent';
import { translationSSRExtensions } from '../editor/extensions/translationSSRExtensions';
import { extractPlainText } from './ssr-text-fallback';

type DangerousProps = {
  className?: string;
  dangerouslySetInnerHTML?: { __html: string };
  children?: string;
};

const renderedHtml = (element: ReactElement<DangerousProps>): string => {
  const html = element.props.dangerouslySetInnerHTML?.__html;
  if (typeof html !== 'string') {
    throw new Error('Expected dangerouslySetInnerHTML html string');
  }
  return html;
};

const passageDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'passage',
      attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            {
              type: 'text',
              text: 'world',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    },
  ],
};

const unknownDoc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'passage',
      attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'somethingUnknown', text: 'x' }],
        },
      ],
    },
  ],
};

describe('TranslationSSRContent', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('renders TipTap JSON as HTML for the passage doc', () => {
    const el = TranslationSSRContent({
      content: passageDoc,
    }) as ReactElement<DangerousProps>;
    const html = renderedHtml(el);
    expect(html).toContain('passage');
    expect(html).toContain('Hello');
    expect(html).toMatch(/<strong[^>]*>world<\/strong>/);
  });

  it('emits no undefined/null/object attribute values in SSR output', () => {
    // The static string renderer serializes attribute values literally, so any
    // extension renderHTML that returns undefined/null/an object leaks it onto
    // crawler-facing markup. Lock the cleaned output (see DEV-644).
    const el = TranslationSSRContent({
      content: passageDoc,
    }) as ReactElement<DangerousProps>;
    const html = renderedHtml(el);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('"null"');
    expect(html).not.toContain('[object Object]');
    expect(html).toMatchInlineSnapshot(
      `"<div label="1.1" sort="0" class="flex md:flex-row flex-col w-full md:gap-10 gap-2 scroll-mt-20"><div class="w-full"><div class="relative scroll-m-20 w-full self-start"><div class="absolute labeled -left-16 w-16 text-end hover:cursor-pointer" contenteditable="false" data-passage-label="">1.1</div><div class="passage-bookmark hidden absolute -left-15.75 top-6 w-16 flex justify-end" contenteditable="false"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent size-3"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div><div class="passage is-editable pl-6 @c/sidebar:pl-4"><p class="no-indent paragraph" type="paragraph">Hello <strong>world</strong></p></div></div></div><div class="passage-compare-source w-full hidden md:mt-1" contenteditable="false" data-compare-source=""><div class="passage pl-6 @c/sidebar:pl-4"><div class="passage-compare-text leading-7 font-tibetan text-lg whitespace-normal mt-1.5 pb-4 md:pb-2"></div></div></div></div>"`,
    );
  });

  it('accepts an array of nodes and wraps them as a doc', () => {
    const el = TranslationSSRContent({
      content: passageDoc.content as JSONContent[],
    }) as ReactElement<DangerousProps>;
    const html = renderedHtml(el);
    expect(html).toContain('Hello');
  });

  it('passes className through to the rendered wrapper', () => {
    const el = TranslationSSRContent({
      content: passageDoc,
      className: 'ssr-body',
    }) as ReactElement<DangerousProps>;
    expect(el.props.className).toBe('ssr-body');
  });

  it('throws in non-production when SSR extension coverage is missing', () => {
    process.env.NODE_ENV = 'test';
    expect(() => TranslationSSRContent({ content: unknownDoc })).toThrow(
      /coverage is incomplete/,
    );
  });

  it('falls back to plain text in production when generation fails', () => {
    process.env.NODE_ENV = 'production';
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const noExtensions: Extensions = [];
    const el = TranslationSSRContent({
      content: passageDoc,
      extensions: noExtensions,
    }) as ReactElement<DangerousProps>;

    expect(el.props.dangerouslySetInnerHTML).toBeUndefined();
    expect(typeof el.props.children).toBe('string');
    expect(el.props.children).toContain('Hello');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('renders endNoteLink marks with start-positioned sups before the content', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'passage',
          attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'marked',
                  marks: [
                    {
                      type: 'endNoteLink',
                      attrs: {
                        notes: [
                          {
                            uuid: 'n-start',
                            endNote: 'en-1',
                            location: 'start',
                            label: '1.a',
                            toh: 'toh1',
                          },
                          {
                            uuid: 'n-end',
                            endNote: 'en-2',
                            label: '1.b',
                            toh: 'toh1',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const el = TranslationSSRContent({
      content: doc,
    }) as ReactElement<DangerousProps>;
    const html = renderedHtml(el);
    expect(html).toContain('marked');
    // Start sup carries a trailing word joiner (U+2060); end sup a leading one,
    // gluing each marker to the content it's attached to.
    expect(html).toMatch(
      /<sup[^>]*me-0\.75[^>]*endNote="en-1"[^>]*>a⁠<\/sup>marked/,
    );
    expect(html).toMatch(/marked<sup[^>]*endNote="en-2"[^>]*>⁠b<\/sup>/);
    // Toh-scoped sups carry a data-toh attribute so the reader's visibility
    // rule can hide markers belonging to inactive toh variants.
    expect(html).toMatch(/<sup[^>]*data-toh="toh1"[^>]*endNote="en-1"/);
    expect(html).toMatch(/<sup[^>]*data-toh="toh1"[^>]*endNote="en-2"/);
  });

  it('renders endNoteLink marks with only end-positioned sups', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'passage',
          attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'marked',
                  marks: [
                    {
                      type: 'endNoteLink',
                      attrs: {
                        notes: [
                          {
                            uuid: 'n-end',
                            endNote: 'en-only',
                            label: '1.c',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const el = TranslationSSRContent({
      content: doc,
    }) as ReactElement<DangerousProps>;
    const html = renderedHtml(el);
    expect(html).toMatch(/marked<sup[^>]*endNote="en-only"[^>]*>⁠c<\/sup>/);
  });

  it('omits orphaned endNoteLink notes with no resolvable label', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'passage',
          attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'marked',
                  marks: [
                    {
                      type: 'endNoteLink',
                      attrs: {
                        notes: [
                          // Orphaned: target endnote deleted, no label resolved.
                          { uuid: 'n-orphan', endNote: 'en-gone' },
                          { uuid: 'n-ok', endNote: 'en-2', label: '1.b' },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const el = TranslationSSRContent({
      content: doc,
    }) as ReactElement<DangerousProps>;
    const html = renderedHtml(el);
    expect(html).toContain('marked');
    // The valid note still renders; the orphaned one is dropped entirely.
    expect(html).toMatch(/endNote="en-2"[^>]*>⁠b<\/sup>/);
    expect(html).not.toContain('en-gone');
  });

  it('exposes the default SSR extension set including passage and bold', () => {
    const names = translationSSRExtensions.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['passage', 'bold']));
  });
});

describe('extractPlainText', () => {
  it('joins text nodes and adds blank lines between blocks', () => {
    const text = extractPlainText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'one' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'two' }],
        },
      ],
    });
    expect(text).toBe('one\n\ntwo');
  });

  it('returns an empty string for an empty doc', () => {
    expect(extractPlainText({ type: 'doc', content: [] })).toBe('');
  });
});
