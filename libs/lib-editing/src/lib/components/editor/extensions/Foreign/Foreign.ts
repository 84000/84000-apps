import { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';
import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export interface ForeignOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    foreign: {
      setForeign: (lang?: ExtendedTranslationLanguage) => ReturnType;
      toggleForeign: (lang?: ExtendedTranslationLanguage) => ReturnType;
      unsetForeign: () => ReturnType;
    };
  }
}

export const ForeignMark = Mark.create<ForeignOptions>({
  name: 'foreign',

  addAttributes() {
    return {
      uuid: {
        default: undefined,
        renderHTML: (attributes) =>
          attributes.uuid ? { uuid: attributes.uuid } : {},
      },
      type: {
        default: 'span',
        renderHTML: (attributes) =>
          attributes.type ? { type: attributes.type } : {},
      },
      textStyle: {
        default: 'foreign',
        renderHTML: (attributes) =>
          attributes.textStyle ? { textStyle: attributes.textStyle } : {},
      },
      lang: {
        default: 'foreign',
        renderHTML: (attributes) =>
          attributes.lang ? { lang: attributes.lang } : {},
      },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-text-style="foreign"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-text-style': 'foreign',
      }),
      0,
    ];
  },

  addCommands() {
    const name = this.name;
    return {
      setForeign:
        (lang?: ExtendedTranslationLanguage) =>
        ({ commands }) => {
          return commands.setMark(name, { lang, uuid: uuidv4() });
        },
      toggleForeign:
        (lang?: ExtendedTranslationLanguage) =>
        ({ commands, editor }) => {
          if (editor.isActive(name, { lang })) {
            return commands.unsetMark(name);
          }
          return commands.setMark(name, { lang, uuid: uuidv4() });
        },
      unsetForeign:
        () =>
        ({ commands }) => {
          return commands.unsetMark(name);
        },
    };
  },
});
