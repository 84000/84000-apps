import StarterKit from '@tiptap/starter-kit';
import { Document } from '../extensions/Document';
import Heading from '../extensions/Heading/Heading';
import Paragraph from '../extensions/Paragraph/Paragraph';
import TranslationTitle from '../extensions/TranslationTitle/TranslationTitle';

export const useExtensions = () => {
  return {
    extensions: [
      Document,
      Heading,
      Paragraph,
      StarterKit.configure({
        document: false,
        heading: false,
        paragraph: false,
      }),
      TranslationTitle,
    ],
  };
};
