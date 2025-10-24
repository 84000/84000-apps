import TiptapHeading from '@tiptap/extension-heading';
import type { Level } from '@tiptap/extension-heading';
import {
  H1_STYLE,
  H2_STYLE,
  H3_STYLE,
  H4_STYLE,
  H5_STYLE,
} from '@design-system';
import { createNodeViewDom } from '../../util';
import { HTMLElementType } from 'react';

const CLASS_FOR_LEVEL: Record<Level, string> = {
  1: H1_STYLE,
  2: H2_STYLE,
  3: H3_STYLE,
  4: H4_STYLE,
  5: H5_STYLE,
  6: H5_STYLE,
};

export const Heading = TiptapHeading.extend({
  addNodeView() {
    return ({ node, editor, extension, getPos, HTMLAttributes }) => {
      const nodeLevel = parseInt(node.attrs.level, 10) as Level;
      const hasLevel = this.options.levels.includes(nodeLevel);
      const level = hasLevel ? nodeLevel : this.options.levels[0];
      const element = `h${level}` as HTMLElementType;
      const className = CLASS_FOR_LEVEL[nodeLevel];

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
