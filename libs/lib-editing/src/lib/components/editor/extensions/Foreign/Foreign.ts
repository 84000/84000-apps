import { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';
import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * The `lang` a foreign mark carries when no language was chosen. It is a
 * stored value, not a language tag, so it is kept in the model (stored data
 * round-trips unchanged) but never rendered as a `lang` attribute. The design
 * system italicises a span with no `lang` by its `data-text-style` instead.
 */
export const UNSPECIFIED_FOREIGN_LANG = 'foreign';

/** The `lang` to render for a foreign mark, if it names a real language. */
export const renderableForeignLang = (lang: unknown): string | undefined =>
  typeof lang === 'string' && lang && lang !== UNSPECIFIED_FOREIGN_LANG
    ? lang
    : undefined;

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
        default: UNSPECIFIED_FOREIGN_LANG,
        renderHTML: (attributes) => {
          const lang = renderableForeignLang(attributes.lang);
          return lang ? { lang } : {};
        },
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
