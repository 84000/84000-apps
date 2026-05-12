import TiptapParagraph from '@tiptap/extension-paragraph';
import { mergeAttributes } from '@tiptap/core';

export const ParagraphSSR = TiptapParagraph.extend({
  addNodeView: undefined,

  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(HTMLAttributes, {
        class: 'paragraph',
        type: 'paragraph',
      }),
      0,
    ];
  },
});

export default ParagraphSSR;
