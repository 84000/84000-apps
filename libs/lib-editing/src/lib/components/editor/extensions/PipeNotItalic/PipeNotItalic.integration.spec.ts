import type { JSONContent } from '@tiptap/core';
import { Editor, Node } from '@tiptap/core';

import { ForeignMark } from '../Foreign/Foreign';
import { Italic } from '../Italic';
import { PipeNotItalic } from './PipeNotItalic';

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
});
const TextNode = Node.create({ name: 'text', group: 'inline' });

/**
 * Mounts a real editor and reads the rendered DOM, so this covers the
 * decorations themselves rather than just the predicate behind them.
 *
 * Content goes in as JSON rather than HTML on purpose: `ForeignMark` defines
 * no `parseHTML` for `lang`, so an HTML fixture silently loses it and every
 * foreign run would look like the default. Passages reach the editor as JSON
 * from the annotation transformers, which is what this mirrors.
 */
const editorHtml = (...content: JSONContent[]): string => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [Doc, Paragraph, TextNode, Italic, ForeignMark, PipeNotItalic],
    content: { type: 'doc', content: [{ type: 'paragraph', content }] },
  });
  const html = editor.view.dom.innerHTML;
  editor.destroy();
  return html;
};

describe('PipeNotItalic', () => {
  it('decorates dandas inside an italic mark', () => {
    const html = editorHtml({
      type: 'text',
      text: 'gang gi | blo gros',
      marks: [{ type: 'italic' }],
    });
    expect(html).toContain('not-italic');
  });

  it('decorates dandas inside a foreign mark, which carries no italic mark', () => {
    const html = editorHtml({
      type: 'text',
      text: 'oṃ | āḥ',
      marks: [{ type: 'foreign', attrs: { lang: 'Sa-Ltn' } }],
    });
    expect(html).toContain('not-italic');
  });

  it('leaves dandas under a lang the design system does not italicise', () => {
    const html = editorHtml({
      type: 'text',
      text: '大 | 乘',
      marks: [{ type: 'foreign', attrs: { lang: 'zh' } }],
    });
    expect(html).not.toContain('not-italic');
  });

  it('leaves dandas in plain text undecorated', () => {
    expect(editorHtml({ type: 'text', text: 'plain | text' })).not.toContain(
      'not-italic',
    );
  });
});
