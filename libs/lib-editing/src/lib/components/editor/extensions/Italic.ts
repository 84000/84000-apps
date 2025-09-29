import { Italic as TiptapItalic } from '@tiptap/extension-italic';
import { mergeAttributes } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

export const Italic = TiptapItalic.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, { 'data-type': attributes.type });
        },
      },
      lang: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-lang'),
        renderHTML(attributes) {
          return mergeAttributes(attributes, { 'data-lang': attributes.lang });
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
  addCommands() {
    const name = this.name;
    return {
      ...this.parent?.(),
      setItalic() {
        return ({ commands }) => {
          return commands.setMark(name, { uuid: uuidv4() });
        };
      },
      toggleItalic() {
        return ({ commands }) => {
          return commands.toggleMark(name, { uuid: uuidv4() });
        };
      },
    };
  },
});
