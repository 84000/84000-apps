import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Component from './Component';

export default Node.create({
  name: 'translationTitle',
  group: 'block',
  content: 'inline*',
  defining: true,
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [
      {
        tag: 'translation-title',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'translation-title',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Component);
  },
});
