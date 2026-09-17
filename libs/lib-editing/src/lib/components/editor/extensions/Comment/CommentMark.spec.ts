import { getSchema, Node } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { AnnotationToh } from '../AnnotationToh';
import { CommentMarkSSR } from './CommentMark.ssr';

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph+',
});

const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  renderHTML: () => ['p', 0],
});

const Text = Node.create({
  name: 'text',
  group: 'inline',
});

const extensions = [Document, Paragraph, Text, AnnotationToh, CommentMarkSSR];
const schema = getSchema(extensions);

const commentMark = (attrs: Record<string, string>) =>
  schema.marks['comment'].create(attrs);

describe('CommentMarkSSR attributes', () => {
  /**
   * `2026-08-26-prosemirror-drops-undeclared-attrs`: ProseMirror builds a
   * mark's attrs from the spec, not from the supplied value, so anything
   * undeclared is `undefined` the moment the document is built — silently, and
   * for good. `toh` is declared by `AnnotationToh` rather than here, which is
   * the half this asserts.
   */
  it('declares every attribute a comment anchor round-trips', () => {
    const attrs = schema.marks['comment'].spec.attrs ?? {};

    expect(Object.keys(attrs).sort()).toEqual([
      'comment',
      'isInline',
      'toh',
      'uuid',
    ]);
  });

  it('keeps the values it was created with', () => {
    const mark = commentMark({
      comment: 'thread-1',
      uuid: 'anchor-1',
      toh: 'toh417',
    });

    expect(mark.attrs.comment).toBe('thread-1');
    expect(mark.attrs.uuid).toBe('anchor-1');
    expect(mark.attrs.toh).toBe('toh417');
  });
});

describe('CommentMarkSSR overlap', () => {
  /**
   * Two anchors over the same words is ordinary, not an edge case — and a mark
   * type excludes itself by default, which would have made the second
   * `setComment` replace the first and orphan its thread.
   */
  it('lets two anchors on different threads cover the same text', () => {
    const first = commentMark({ comment: 'thread-1', uuid: 'anchor-1' });
    const second = commentMark({ comment: 'thread-2', uuid: 'anchor-2' });

    const set = second.addToSet(first.addToSet([]));

    expect(set).toHaveLength(2);
    expect(set.map((mark) => mark.attrs.comment).sort()).toEqual([
      'thread-1',
      'thread-2',
    ]);
  });

  it('renders nested anchors as nested spans', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('outer ', [
          commentMark({ comment: 'thread-1', uuid: 'anchor-1' }),
        ]),
        schema.text('both', [
          commentMark({ comment: 'thread-1', uuid: 'anchor-1' }),
          commentMark({ comment: 'thread-2', uuid: 'anchor-2' }),
        ]),
      ]),
    ]);

    const html = renderToHTMLString({ extensions, content: doc.toJSON() });

    expect(html).toContain('comment="thread-1"');
    expect(html).toContain('comment="thread-2"');
    expect(html).toContain('uuid="anchor-2"');
  });
});

describe('CommentMarkSSR parse/render round trip', () => {
  it('carries comment, uuid and toh through a render and parse back', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('commented', [
          commentMark({
            comment: 'thread-1',
            uuid: 'anchor-1',
            toh: 'toh417',
          }),
        ]),
      ]),
    ]);

    const html = renderToHTMLString({ extensions, content: doc.toJSON() });

    expect(html).toContain('type="comment"');
    expect(html).toContain('comment="thread-1"');
    expect(html).toContain('uuid="anchor-1"');
    // `data-toh` is what the reader's toh-visibility rule reads.
    expect(html).toContain('data-toh="toh417"');
    // Internal-only state, and `rendered: false` keeps it out of the DOM.
    expect(html).not.toContain('isInline');
  });
});
