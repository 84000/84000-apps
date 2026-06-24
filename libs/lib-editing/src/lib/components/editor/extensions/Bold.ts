import { Bold as TipTapBold } from '@tiptap/extension-bold';
import { v4 as uuidv4 } from 'uuid';

export const Bold = TipTapBold.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) =>
          attributes.type ? { 'data-type': attributes.type } : {},
      },
      textStyle: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-text-style'),
        renderHTML: (attributes) =>
          attributes.textStyle
            ? { 'data-text-style': attributes.textStyle }
            : {},
      },
      lang: {
        default: undefined,
        parseHTML: (element) => element.getAttribute('data-lang'),
        renderHTML: (attributes) =>
          attributes.lang ? { 'data-lang': attributes.lang } : {},
      },
    };
  },
  addCommands() {
    const name = this.name;
    return {
      ...this.parent?.(),
      setBold() {
        return ({ commands, tr }) => {
          const lang = tr.selection.$from.parent.attrs.lang;
          const textStyle = tr.selection.$from.parent.attrs.textStyle;
          return commands.setMark(name, { uuid: uuidv4(), lang, textStyle });
        };
      },
      toggleBold() {
        return ({ commands, tr }) => {
          const lang = tr.selection.$from.parent.attrs.lang;
          const textStyle = tr.selection.$from.parent.attrs.textStyle;
          return commands.toggleMark(name, { uuid: uuidv4(), lang, textStyle });
        };
      },
    };
  },
});
