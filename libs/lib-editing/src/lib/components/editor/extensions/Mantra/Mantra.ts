import { TranslationLanguage } from '@eightyfourthousand/data-access';
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
      uuid: {
        default: undefined,
      },
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
    const name = this.name;
    return {
      setMantra:
        (lang?: TranslationLanguage) =>
        ({ commands }) => {
          return commands.setMark(name, { lang, uuid: uuidv4() });
        },
      toggleMantra:
        (lang?: TranslationLanguage) =>
        ({ commands, editor }) => {
          if (editor.isActive(name, { lang })) {
            return commands.unsetMark(name);
          }
          return commands.setMark(name, { lang, uuid: uuidv4() });
        },
      unsetMantra:
        () =>
        ({ commands }) => {
          return commands.unsetMark(name);
        },
    };
  },
});
