import { mergeAttributes } from '@tiptap/react';
import { Superscript as TipTapSuperscript } from '@tiptap/extension-superscript';
import { v4 as uuidv4 } from 'uuid';

export const Superscript = TipTapSuperscript.extend({
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
    };
  },
  addCommands() {
    const name = this.name;
    return {
      ...this.parent?.(),
      setSuperscript() {
        return ({ commands }) => {
          return commands.setMark(name, { uuid: uuidv4() });
        };
      },
      toggleSuperscript() {
        return ({ commands }) => {
          return commands.toggleMark(name, { uuid: uuidv4() });
        };
      },
    };
  },
});
