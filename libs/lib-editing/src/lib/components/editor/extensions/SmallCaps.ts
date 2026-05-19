import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export interface SmallCapsOptions {
  /**
   * HTML attributes to add to the small caps element.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    smallCaps: {
      /**
       * Set a small caps mark
       * @example editor.commands.setSmallCaps()
       */
      setSmallCaps: () => ReturnType;
      /**
       * Toggle a small caps mark
       * @example editor.commands.toggleSmallCaps()
       */
      toggleSmallCaps: () => ReturnType;
      /**
       * Unset a small caps mark
       * @example editor.commands.unsetSmallCaps()
       */
      unsetSmallCaps: () => ReturnType;
    };
  }
}

/**
 * This extension allows you to create small caps text.
 */
export const SmallCaps = Mark.create<SmallCapsOptions>({
  name: 'smallCaps',
  addAttributes() {
    return {
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, { 'data-type': attributes.type });
        },
      },
      textStyle: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-text-style'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, {
            'data-text-style': attributes.textStyle,
          });
        },
      },
      lang: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-lang'),
        renderHTML(attributes) {
          if (!attributes.lang) {
            return attributes;
          }
          return mergeAttributes(attributes, { 'data-lang': attributes.lang });
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
    return [
      {
        tag: 'sm[type="small-caps"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sm',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'uppercase',
      }),
      0,
    ];
  },

  addCommands() {
    const name = this.name;
    return {
      setSmallCaps:
        () =>
        ({ commands, tr }) => {
          const lang = tr.selection.$from.parent.attrs.lang;
          const textStyle = tr.selection.$from.parent.attrs.textStyle;
          return commands.setMark(name, { uuid: uuidv4(), lang, textStyle });
        },
      toggleSmallCaps:
        () =>
        ({ commands, tr }) => {
          const lang = tr.selection.$from.parent.attrs.lang;
          const textStyle = tr.selection.$from.parent.attrs.textStyle;
          return commands.toggleMark(name, { uuid: uuidv4(), lang, textStyle });
        },
      unsetSmallCaps:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-+': () => this.editor.commands.toggleSmallCaps(),
    };
  },
});
