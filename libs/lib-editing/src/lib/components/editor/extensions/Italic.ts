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
  addCommands() {
    const name = this.name;
    return {
      ...this.parent?.(),
      setItalic() {
        return ({ commands, tr }) => {
          const lang = tr.selection.$from.parent.attrs.lang;
          const textStyle = tr.selection.$from.parent.attrs.textStyle;
          return commands.setMark(name, { uuid: uuidv4(), lang, textStyle });
        };
      },
      toggleItalic() {
        return ({ commands, tr }) => {
          const lang = tr.selection.$from.parent.attrs.lang;
          const textStyle = tr.selection.$from.parent.attrs.textStyle;
          return commands.toggleMark(name, { uuid: uuidv4(), lang, textStyle });
        };
      },
    };
  },
});
