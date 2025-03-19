import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Component from './Component';

export default Node.create({
  name: 'translation',
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
        tag: 'passage-translation',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'passage-translation',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Component);
  },
});
