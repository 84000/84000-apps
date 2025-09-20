import { mergeAttributes } from '@tiptap/core';
import TiptapHeading from '@tiptap/extension-heading';
import type { Level } from '@tiptap/extension-heading';
import {
  H1_STYLE,
  H2_STYLE,
  H3_STYLE,
  H4_STYLE,
  H5_STYLE,
} from '@design-system';

const classForLevel: Record<Level, string> = {
  1: H1_STYLE,
  2: H2_STYLE,
  3: H3_STYLE,
  4: H4_STYLE,
  5: H5_STYLE,
  6: H5_STYLE,
};

export const Heading = TiptapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-class'),
        renderHTML: (attributes) => {
          if (!attributes.class) {
            return {};
          }
          return { 'data-class': attributes.class };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const nodeLevel = parseInt(node.attrs.level, 10) as Level;
    const hasLevel = this.options.levels.includes(nodeLevel);
    const level = hasLevel ? nodeLevel : this.options.levels[0];

    this.options.HTMLAttributes = {
      ...this.options.HTMLAttributes,
      class: classForLevel[level],
    };

    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

export default Heading;
