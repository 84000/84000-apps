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
    return {
      setSmallCaps:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name, { uuid: uuidv4() });
        },
      toggleSmallCaps:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { uuid: uuidv4() });
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
