import TiptapHeading from '@tiptap/extension-heading';
import type { Level } from '@tiptap/extension-heading';
import { createNodeViewDom } from '../../util';
import { HTMLElementType } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';
import { CLASS_FOR_CLASS, CLASS_FOR_LEVEL } from './classes';

export const Heading = TiptapHeading.extend({
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

  addNodeView() {
    return ({ node, editor, extension, getPos, HTMLAttributes }) => {
      const nodeLevel = parseInt(node.attrs.level, 10) as Level;
      const hasLevel = this.options.levels.includes(nodeLevel);
      const level = hasLevel ? nodeLevel : this.options.levels.at(-1);
      const element = `h${level}` as HTMLElementType;
      const className = cn(CLASS_FOR_LEVEL[nodeLevel], CLASS_FOR_CLASS[node.attrs.class]);

      const { dom } = createNodeViewDom({
        editor,
        getPos,
        node,
        extension,
        HTMLAttributes,
        element,
        className,
      });

      return {
        dom,
        contentDOM: dom,
      };
    };
  },
});

export default Heading;
