import TiptapParagraph from '@tiptap/extension-paragraph';
import { createNodeViewDom } from '../../util';

export const Paragraph = TiptapParagraph.extend({
  addNodeView() {
    return ({ node, extension, editor, getPos, HTMLAttributes }) => {
      const { dom } = createNodeViewDom({
        editor,
        getPos,
        node,
        extension,
        HTMLAttributes,
        element: 'p',
        className: 'paragraph',
      });

      return {
        dom,
        contentDOM: dom,
      };
    };
  },
});

export default Paragraph;
