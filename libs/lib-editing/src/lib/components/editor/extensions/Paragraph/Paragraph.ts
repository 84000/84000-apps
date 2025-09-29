import TiptapParagraph from '@tiptap/extension-paragraph';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ParagraphView } from './ParagraphView';

export const Paragraph = TiptapParagraph.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ParagraphView);
  },
});

export default Paragraph;
