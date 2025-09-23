import {
  StarterKitOptions,
  StarterKit as TiptapStarterKit,
} from '@tiptap/starter-kit';
import { BLOCKQUOTE_STYLE, CODE_STYLE, OL_STYLE } from '@design-system';

export const STARTER_KIT_CONFIG: Partial<StarterKitOptions> = {
  document: false,
  heading: false,
  paragraph: false,
  italic: false,
  link: false,
  underline: false,
  bold: false,
  bulletList: false,
  code: {
    HTMLAttributes: {
      class: CODE_STYLE,
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: OL_STYLE,
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: BLOCKQUOTE_STYLE,
    },
  },
};

export const StarterKit = TiptapStarterKit.configure(STARTER_KIT_CONFIG);

export default StarterKit;
