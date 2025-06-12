import { Node } from '@tiptap/core';
import { mergeAttributes, wrappingInputRule } from '@tiptap/react';

export interface LineGroupOptions {
  iitemTypeName: string;
  HTMLAttributes: Record<string, unknown>;
  keepMarks: boolean;
  keepAttributes: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineGroup: {
      toggleLineGroup: () => ReturnType;
    };
  }
}

/**
 * Matches a bullet list to a tilde.
 */
export const inputRegex = /^\s*([~])\s$/;

export const LineGroupNode = Node.create({
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
      mergeAttributes(
        { type: 'line-group', class: '[&:not(:first-child)]:mt-6' },
        HTMLAttributes,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      toggleLineGroup:
        () =>
        ({ commands, chain }) => {
          if (this.options.keepAttributes) {
            return chain()
              .toggleList(
                this.name,
                this.options.itemTypeName,
                this.options.keepMarks,
              )
              .updateAttributes('line', this.editor.getAttributes('textStyle'))
              .run();
          }
          return commands.toggleList(
            this.name,
            this.options.itemTypeName,
            this.options.keepMarks,
          );
        },
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'line-group',
        parseHTML: (element) => element.getAttribute('type'),
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleLineGroup(),
    };
  },

  addInputRules() {
    let inputRule = wrappingInputRule({
      find: inputRegex,
      type: this.type,
    });

    if (this.options.keepMarks || this.options.keepAttributes) {
      inputRule = wrappingInputRule({
        find: inputRegex,
        type: this.type,
        keepMarks: this.options.keepMarks,
        keepAttributes: this.options.keepAttributes,
        getAttributes: () => {
          return this.editor.getAttributes('textStyle');
        },
        editor: this.editor,
      });
    }
    return [inputRule];
  },
});
