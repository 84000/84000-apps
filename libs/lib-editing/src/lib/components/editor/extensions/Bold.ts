import { mergeAttributes } from '@tiptap/react';
import { Bold as TipTapBold } from '@tiptap/extension-bold';
import { v4 as uuidv4 } from 'uuid';

export const Bold = TipTapBold.extend({
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
      setBold() {
        return ({ commands }) => {
          return commands.setMark(name, { uuid: uuidv4() });
        };
      },
      toggleBold() {
        return ({ commands }) => {
          return commands.toggleMark(name, { uuid: uuidv4() });
        };
      },
    };
  },
});
