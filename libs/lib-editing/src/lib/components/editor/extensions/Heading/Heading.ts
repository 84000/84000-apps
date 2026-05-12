import TiptapHeading from '@tiptap/extension-heading';
import { createNodeViewDom } from '../../util';
import { HTMLElementType } from 'react';
import { resolveHeadingPresentation } from './classes';

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
      const { tag, className } = resolveHeadingPresentation({
        rawLevel: node.attrs.level,
        classAttr: node.attrs.class,
        levels: this.options.levels,
      });

      const { dom } = createNodeViewDom({
        editor,
        getPos,
        node,
        extension,
        HTMLAttributes,
        element: tag as HTMLElementType,
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
