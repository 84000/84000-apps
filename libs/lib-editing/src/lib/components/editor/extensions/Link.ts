import { LINK_STYLE } from '@design-system';
import Link from '@tiptap/extension-link';

export default Link.configure({
  HTMLAttributes: {
    class: LINK_STYLE,
  },
  openOnClick: true,
});
