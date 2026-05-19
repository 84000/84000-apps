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
      },
      type: {
        default: 'span',
      },
      textStyle: {
        default: 'foreign',
      },
      lang: {
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
      { tag: 'span[data-text-style="foreign"]' },
      { tag: 'i[data-text-style="foreign"]' },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const lang = mark.attrs.lang;
    return [
      'i',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-text-style': 'foreign',
        ...(lang ? { lang, 'data-lang': lang } : {}),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setForeign:
        (lang?: ExtendedTranslationLanguage) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name)
            .updateAttributes(this.name, {
              lang,
              uuid: uuidv4(),
            })
            .run();
        },
      toggleForeign:
        (lang?: ExtendedTranslationLanguage) =>
        ({ commands }) => {
          if (this.editor.isActive(this.name, { lang })) {
            return commands.unsetForeign();
          }
          return commands.setForeign(lang);
        },
      unsetForeign:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, 'lang')
            .run();
        },
    };
  },
});
