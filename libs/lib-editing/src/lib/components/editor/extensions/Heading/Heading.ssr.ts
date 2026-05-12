import TiptapHeading from '@tiptap/extension-heading';
import type { Level } from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';
import { cn } from '@eightyfourthousand/lib-utils';
import { CLASS_FOR_CLASS, CLASS_FOR_LEVEL } from './classes';

export const HeadingSSR = TiptapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML(element) {
          return element.getAttribute('class');
        },
      },
    };
  },

  addNodeView: undefined,

  renderHTML({ node, HTMLAttributes }) {
    const nodeLevel = parseInt(node.attrs.level, 10) as Level;
    const hasLevel = this.options.levels.includes(nodeLevel);
    const level = hasLevel ? nodeLevel : this.options.levels.at(-1);
    const className = cn(
      CLASS_FOR_LEVEL[nodeLevel],
      CLASS_FOR_CLASS[node.attrs.class as string],
    );

    return [
      `h${level}`,
      mergeAttributes(HTMLAttributes, {
        class: className,
        type: 'heading',
      }),
      0,
    ];
  },
});

export default HeadingSSR;
