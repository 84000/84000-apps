import { Extension, mergeAttributes } from '@tiptap/core';

export interface ParagraphIndentOptions {
  types: string[];
  defaultHasParagraphIndent: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphIndent: {
      /**
       * Add an indent
       */
      setParagraphIndent: () => ReturnType;
      /**
       * Remove an indent
       */
      unsetParagraphIndent: () => ReturnType;

      /**
       * Toggle an indent
       */
      toggleParagraphIndent: () => ReturnType;
    };
  }
}

export const ParagraphIndent = Extension.create<ParagraphIndentOptions>({
  name: 'paragraphIndent',
  addOptions() {
    return {
      types: ['paragraph'],
      defaultHasParagraphIndent: false,
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          hasParagraphIndent: {
            default: this.options.defaultHasParagraphIndent,
            parseHTML: (element) =>
              element.className.includes('conditional-indent'),
            renderHTML: (attributes) => {
              if (attributes.hasParagraphIndent) {
                return mergeAttributes(attributes, {
                  class: 'conditional-indent',
                });
              }
              return mergeAttributes(attributes, { class: 'no-indent' });
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setParagraphIndent:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) =>
              commands.updateAttributes(type, { hasParagraphIndent: true }),
            )
            .every((response) => response);
        },
      unsetParagraphIndent:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, 'hasParagraphIndent'))
            .every((response) => response);
        },
      toggleParagraphIndent:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive({ hasParagraphIndent: true })) {
            return commands.unsetParagraphIndent();
          }
          return commands.setParagraphIndent();
        },
    };
  },
});
