import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Holds an inline title whose language is not set in italics (e.g. Chinese or
 * Japanese). Titles in italic languages ride on the italic mark instead.
 *
 * Preserve-and-display only: no commands, no toolbar entry, and it does not
 * extend as text is typed at its edge. It exists so the title loads, renders
 * upright under its `lang`, and is saved back unchanged.
 */
export const InlineTitleMark = Mark.create({
  name: 'inlineTitle',
  inclusive: false,

  addAttributes() {
    return {
      uuid: {
        default: undefined,
        renderHTML: (attributes) =>
          attributes.uuid ? { uuid: attributes.uuid } : {},
      },
      type: {
        default: 'inlineTitle',
        renderHTML: () => ({ 'data-type': 'inline-title' }),
        parseHTML: () => 'inlineTitle',
      },
      lang: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('lang'),
        renderHTML: (attributes) =>
          attributes.lang ? { lang: attributes.lang } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-title"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});
