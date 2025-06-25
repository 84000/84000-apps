import TiptapParagraph from '@tiptap/extension-paragraph';

export const Paragraph = TiptapParagraph.configure({
  HTMLAttributes: {
    class: 'leading-7 mb-1 [&:not(:first-child)]:mt-6',
  },
});

export default Paragraph;
