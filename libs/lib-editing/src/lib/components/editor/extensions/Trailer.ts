import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trailer: {
      /**
       * Make block a trailer
       */
      setTrailer: () => ReturnType;
      /**
       * Toggle block a trailer
       */
      toggleTrailer: () => ReturnType;
    };
  }
}

export const Trailer = Node.create({
  name: 'trailer',
  priority: 1000,
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [
      {
        tag: 'p[type="trailer"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(HTMLAttributes, {
        type: 'trailer',
        class: 'italic my-4',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setTrailer:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name);
        },
      toggleTrailer:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph');
        },
    };
  },
});
