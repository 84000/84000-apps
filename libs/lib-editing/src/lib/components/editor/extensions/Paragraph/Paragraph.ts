import TiptapParagraph from '@tiptap/extension-paragraph';

export const Paragraph = TiptapParagraph.configure({
  HTMLAttributes: {
    class: 'leading-7 mb-1 mt-2',
  },
});

export default Paragraph;
