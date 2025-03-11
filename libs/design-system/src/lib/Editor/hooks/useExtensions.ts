import StarterKit from '@tiptap/starter-kit';
import { Document } from '../extensions/Document';

export const useExtensions = () => {
  return {
    extensions: [Document, StarterKit.configure({ document: false })],
  };
};
