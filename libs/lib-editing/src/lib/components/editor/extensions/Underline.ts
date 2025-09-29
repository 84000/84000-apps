import { mergeAttributes } from '@tiptap/react';
import { Underline as TipTapUnderline } from '@tiptap/extension-underline';
import { v4 as uuidv4 } from 'uuid';

export const Underline = TipTapUnderline.extend({
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
      setUnderline() {
        return ({ commands }) => {
          return commands.setMark(name, { uuid: uuidv4() });
        };
      },
      toggleUnderline() {
        return ({ commands }) => {
          return commands.toggleMark(name, { uuid: uuidv4() });
        };
      },
    };
  },
});
