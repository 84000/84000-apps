import Link from '@tiptap/extension-link';
import { LINK_STYLE } from '../../Typography/Typography';

export default Link.configure({
  HTMLAttributes: {
    class: LINK_STYLE,
  },
  openOnClick: true,
});
