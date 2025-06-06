import { cn } from '@lib-utils';
import Link from '@tiptap/extension-link';

export default Link.configure({
  HTMLAttributes: {
    class: cn(
      '!text-foreground underline underline-offset-[3px] transition-colors cursor-pointer',
    ),
  },
  openOnClick: false,
});
