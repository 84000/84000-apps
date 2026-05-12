import { Node, mergeAttributes } from '@tiptap/core';

export const LineNodeSSR = Node.create({
  name: 'line',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: 'text*',

  defining: true,

  parseHTML() {
    return [
      {
        tag: 'li[type="line"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(
        { type: 'line', class: '-indent-8 pl-8' },
        HTMLAttributes,
      ),
      0,
    ];
  },
});

export default LineNodeSSR;
