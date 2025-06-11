import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';

export const LineNode = Node.create({
  name: 'line',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [
      {
        tag: 'line',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes({ class: '-indent-8 pl-8' }, HTMLAttributes),
      0,
    ];
  },
});
