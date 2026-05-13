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
    expect(html).toContain('<strong>world</strong>');
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
