import { WordBreakValue } from '@eightyfourthousand/data-access';
import { Extension } from '@tiptap/core';

export interface WordBreakOptions {
  /**
   * The node types where the `word-break` style can be applied.
   * @default ['paragraph']
   */
  types: string[];
  /**
   * The allowed `word-break` values.
   * @default ['normal', 'break-all']
   */
  wordBreaks: string[];
  /**
   * The default `word-break`. When `null`, no style is rendered and the value
   * is not persisted, so the block falls back to its CSS default.
   * @default null
   */
  defaultWordBreak: WordBreakValue | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wordBreak: {
      /**
       * Set the `word-break` style.
       */
      setWordBreak: (wordBreak: WordBreakValue) => ReturnType;
      /**
       * Unset the `word-break` style.
       */
      unsetWordBreak: () => ReturnType;
    };
  }
}

/**
 * This extension adds a `word-break` style to the supported nodes. It mirrors
 * the `@tiptap/extension-text-align` extension, but controls the CSS
 * `word-break` property and only applies to paragraphs by default.
 */
export const WordBreak = Extension.create<WordBreakOptions>({
  name: 'wordBreak',

  addOptions() {
    return {
      types: ['paragraph'],
      wordBreaks: ['normal', 'break-all'],
      defaultWordBreak: null,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          wordBreak: {
            default: this.options.defaultWordBreak,
            parseHTML: (element) => {
              const wordBreak = element.style.wordBreak;
              return this.options.wordBreaks.includes(wordBreak)
                ? wordBreak
                : this.options.defaultWordBreak;
            },
            renderHTML: (attributes) => {
              if (!attributes.wordBreak) {
                return {};
              }
              return { style: `word-break: ${attributes.wordBreak}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setWordBreak:
        (wordBreak) =>
        ({ commands }) => {
          if (!this.options.wordBreaks.includes(wordBreak)) {
            return false;
          }
          return this.options.types
            .map((type) => commands.updateAttributes(type, { wordBreak }))
            .some((response) => response);
        },
      unsetWordBreak:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, 'wordBreak'))
            .some((response) => response);
        },
    };
  },
});

export default WordBreak;
