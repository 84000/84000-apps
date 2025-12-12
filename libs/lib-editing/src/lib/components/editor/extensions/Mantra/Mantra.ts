import { TranslationLanguage } from '@data-access';
import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export interface MantraOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mantra: {
      setMantra: (lang?: TranslationLanguage) => ReturnType;
      toggleMantra: (lang?: TranslationLanguage) => ReturnType;
      unsetMantra: () => ReturnType;
    };
  }
}

export const MantraMark = Mark.create<MantraOptions>({
  name: 'mantra',
  addAttributes() {
    return {
      type: {
        default: 'mantra',
      },
      lang: {
        default: 'Sa-Ltn',
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
        tag: 'span[type="mantra"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const lang = mark.attrs.lang;
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        lang,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setMantra:
        (lang?: TranslationLanguage) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name)
            .updateAttributes(this.name, {
              lang,
              uuid: uuidv4(),
            })
            .run();
        },
      toggleMantra:
        (lang?: TranslationLanguage) =>
        ({ commands }) => {
          if (this.editor.isActive(this.name, { lang })) {
            return commands.unsetMantra();
          }
          return commands.setMantra(lang);
        },
      unsetMantra:
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
