import { Mark, mergeAttributes } from '@tiptap/core';

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
        default: 'small-caps',
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
        tag: 'sm[type="smal-caps"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sm',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'uppercase text-xs',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSmallCaps:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      toggleSmallCaps:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
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
