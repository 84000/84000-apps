import { Italic as TiptapItalic } from '@tiptap/extension-italic';
import { mergeAttributes } from '@tiptap/react';

export const Italic = TiptapItalic.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('type'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, { type: attributes.type });
        },
      },
      language: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('language'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, { type: attributes.language });
        },
      },
    };
  },
});
