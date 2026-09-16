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
  // Above Paragraph's 1000: both claim `p`, and the more specific
  // `p[type="trailer"]` has to be tried first.
  priority: 1100,
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
