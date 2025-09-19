import { Extension, mergeAttributes } from '@tiptap/core';

export interface IndentOptions {
  types: string[];
  defaultHasIndent: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /**
       * Add an indent
       */
      setIndent: () => ReturnType;
      /**
       * Remove an indent
       */
      unsetIndent: () => ReturnType;

      /**
       * Toggle an indent
       */
      toggleIndent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',
  addOptions() {
    return {
      types: ['paragraph'],
      defaultHasIndent: false,
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          hasIndent: {
            default: this.options.defaultHasIndent,
            parseHTML: (element) => element.className.includes('pl-8'),
            renderHTML: (attributes) => {
              if (!attributes.hasIndent) {
                return {};
              }
              return mergeAttributes(attributes, { class: 'pl-8' });
            },
          },
          indentUuid: {
            default: undefined,
            parseHTML: (element) =>
              element.getAttribute('data-indent-uuid') || undefined,
            renderHTML: (attributes) => {
              if (!attributes.indentUuid) {
                return {};
              }
              return {
                'data-indent-uuid': attributes.indentUuid,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setIndent:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.updateAttributes(type, { hasIndent: true }))
            .every((response) => response);
        },
      unsetIndent:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, 'hasIndent'))
            .every((response) => response);
        },
      toggleIndent:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive({ hasIndent: true })) {
            return commands.unsetIndent();
          }
          return commands.setIndent();
        },
    };
  },
});
