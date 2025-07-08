import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';

export const LineNode = Node.create({
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

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
    };
  },
});
