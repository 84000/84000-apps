import { StarterKit as TiptapStarterKit } from '@tiptap/starter-kit';
import {
  BLOCKQUOTE_STYLE,
  CODE_STYLE,
  OL_STYLE,
  UL_STYLE,
} from '../../Typography/Typography';

export default TiptapStarterKit.configure({
  document: false,
  heading: false,
  paragraph: false,
  bulletList: {
    HTMLAttributes: {
      class: UL_STYLE,
    },
  },
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
});
