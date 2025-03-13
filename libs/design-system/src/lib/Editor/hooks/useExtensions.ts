import StarterKit from '@tiptap/starter-kit';
import { Document } from '../extensions/Document';
import Heading from '../extensions/Heading';

export const useExtensions = () => {
  return {
    extensions: [
      Document,
      Heading,
      StarterKit.configure({ document: false, heading: false }),
    ],
  };
};
