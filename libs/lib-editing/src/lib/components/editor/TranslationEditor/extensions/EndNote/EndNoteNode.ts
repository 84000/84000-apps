import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/react';

export interface EndNoteOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNote: {
      /**
       * Toggle an end note
       * @example editor.commands.setEndNote()
       */
      setEndNote: () => ReturnType;
    };
  }
}

export const EndNoteNode = Node.create({
  name: 'endNote',

  priority: 100,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'inline*',

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(
        { type: 'end-note', class: 'leading-7 mb-1' },
        HTMLAttributes,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setEndNote:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name);
        },
    };
  },
});
