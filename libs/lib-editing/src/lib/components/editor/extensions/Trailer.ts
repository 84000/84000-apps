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
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [
      {
        // Both this and Paragraph claim `p`, and the more specific rule has to
        // be tried first. The precedence belongs on the rule, not on the
        // extension: an extension priority above Paragraph's also sorts this
        // node ahead of it in the schema, and a content match takes its
        // default type from that order — which made every Enter produce an
        // italic trailer instead of a paragraph.
        priority: 60,
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
