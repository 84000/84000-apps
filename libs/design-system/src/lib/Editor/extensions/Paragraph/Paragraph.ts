import { mergeAttributes } from '@tiptap/core';
import TiptapParagraph from '@tiptap/extension-paragraph';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Component from './Component';

export const Paragraph = TiptapParagraph.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Component);
  },
});

export default Paragraph;
