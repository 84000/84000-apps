import { WhitespaceValue } from '@eightyfourthousand/data-access';
import { Extension } from '@tiptap/core';

export interface WhitespaceOptions {
  /**
   * The node types where the `white-space` style can be applied.
   * @default ['paragraph']
   */
  types: string[];
  /**
   * The allowed `white-space` values.
   * @default ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces']
   */
  whitespaces: string[];
  /**
   * The default `white-space`. When `null`, no style is rendered and the value
   * is not persisted, so the block falls back to its CSS default.
   * @default null
   */
  defaultWhitespace: WhitespaceValue | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    whitespace: {
      /**
       * Set the `white-space` style.
       */
      setWhitespace: (whitespace: WhitespaceValue) => ReturnType;
      /**
       * Unset the `white-space` style.
       */
      unsetWhitespace: () => ReturnType;
    };
  }
}

/**
 * This extension adds a `white-space` style to the supported nodes. It mirrors
 * the `@tiptap/extension-text-align` extension, but controls the CSS
 * `white-space` property and only applies to paragraphs by default.
 */
export const Whitespace = Extension.create<WhitespaceOptions>({
  name: 'whitespace',

  addOptions() {
    return {
      types: ['paragraph'],
      whitespaces: [
        'normal',
        'nowrap',
        'pre',
        'pre-wrap',
        'pre-line',
        'break-spaces',
      ],
      defaultWhitespace: null,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          whitespace: {
            default: this.options.defaultWhitespace,
            parseHTML: (element) => {
              const whitespace = element.style.whiteSpace;
              return this.options.whitespaces.includes(whitespace)
                ? whitespace
                : this.options.defaultWhitespace;
            },
            renderHTML: (attributes) => {
              if (!attributes.whitespace) {
                return {};
              }
              return { style: `white-space: ${attributes.whitespace}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setWhitespace:
        (whitespace) =>
        ({ commands }) => {
          if (!this.options.whitespaces.includes(whitespace)) {
            return false;
          }
          return this.options.types
            .map((type) =>
              commands.updateAttributes(type, { whitespace }),
            )
            .some((response) => response);
        },
      unsetWhitespace:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, 'whitespace'))
            .some((response) => response);
        },
    };
  },
});

export default Whitespace;
