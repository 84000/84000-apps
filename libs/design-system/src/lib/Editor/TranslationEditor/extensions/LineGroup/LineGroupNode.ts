import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineGroup: {
      toggleLineGroup: () => ReturnType;
    };
  }
}

export const LineGroupNode = Node.create({
  name: 'lineGroup',
  group: 'block',
  content: 'line*',
  parseHTML() {
    return [
      {
        tag: 'line-group',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes({ class: '[&:not(:first-child)]:mt-6' }, HTMLAttributes),
      0,
    ];
  },
  addCommands() {
    return {
      toggleLineGroup:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
    };
  },
});
