import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Component from './Component';

export default Node.create({
  name: 'translationHeader',
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
        tag: 'passage-translation-header',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'paggage-translation-header',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Component);
  },
});
