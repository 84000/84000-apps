import { cn } from '@lib-utils';
import Link from '@tiptap/extension-link';

export default Link.configure({
  HTMLAttributes: {
    class: cn(
      'text-slate underline decoration-slate underline-offset-[3px] transition-colors cursor-pointer',
    ),
  },
  openOnClick: true,
});
