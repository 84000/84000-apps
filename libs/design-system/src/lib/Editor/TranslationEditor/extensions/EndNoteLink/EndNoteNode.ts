import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { EndNoteLink } from './EndNoteLink';

export interface EndNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNoteLink: {
      setEndNoteLink: (endNote: string) => ReturnType;
      unsetEndNoteLink: () => ReturnType;
    };
  }
}

export const EndNoteLinkNode = Node.create<EndNoteLinkOptions>({
  name: 'endNoteLink',
  group: 'inline',
  inline: true,
  atom: false, // Changed to false to make content selectable
  draggable: true,
  selectable: true, // Explicitly make it selectable

  addAttributes() {
    return {
      endNote: {
        default: undefined,
      },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[type="endNoteLink"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, type: 'endNoteLink' }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EndNoteLink, {
      contentDOMElementTag: 'span',
    });
  },

  addCommands() {
    return {
      setEndNoteLink:
        (endNote) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { endNote },
          });
        },
      unsetEndNoteLink:
        () =>
        ({ commands }) => {
          return commands.deleteSelection();
        },
    };
  },
});
