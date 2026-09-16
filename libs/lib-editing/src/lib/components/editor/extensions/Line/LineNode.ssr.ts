import { Node, mergeAttributes } from '@tiptap/core';

export const LineNodeSSR = Node.create({
  name: 'line',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: 'inline*',

  defining: true,

  parseHTML() {
    return [
      {
        tag: 'li[type="line"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // The intrinsic attributes go last: a globally declared `type` arrives
    // here as null and would otherwise erase the one the parse rule matches on.
    return [
      'li',
      mergeAttributes(HTMLAttributes, {
        type: 'line',
        class: '-indent-8 pl-8',
      }),
      0,
    ];
  },
});

export default LineNodeSSR;
