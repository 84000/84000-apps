import { Node, mergeAttributes } from '@tiptap/core';

export const LineGroupNodeSSR = Node.create({
  name: 'lineGroup',

  addOptions() {
    return {
      itemTypeName: 'line',
      HTMLAttributes: {},
      keepMarks: false,
      keepAttributes: false,
    };
  },

  group: 'block list',

  content() {
    return `${this.options.itemTypeName}+`;
  },

  parseHTML() {
    return [
      {
        tag: 'ul[type="line-group"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes({ type: 'line-group', class: 'my-4' }, HTMLAttributes),
      0,
    ];
  },

  addAttributes() {
    return {
      type: {
        default: 'line-group',
        parseHTML: (element) => element.getAttribute('type'),
      },
    };
  },
});

export default LineGroupNodeSSR;
