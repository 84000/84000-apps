import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  LINK_STYLE,
} from '@design-system';
import { MarkViewContent, MarkViewProps } from '@tiptap/react';
import { GlobeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';

export const LinkView = ({ mark }: MarkViewProps) => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link href={mark.attrs.href} target="_blank" rel="noreferrer">
          <MarkViewContent className={LINK_STYLE} />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="flex justify-between gap-2 p-2 w-fit max-w-64"
      >
        <GlobeIcon size={14} className="text-muted-foreground my-auto" />
        <span className="truncate text-muted-foreground text-sm">
          {mark.attrs.href}
        </span>
        <span className="flex-grow" />
        <PencilIcon size={14} className="text-primary my-auto" />
        <Trash2Icon size={14} className="text-destructive my-auto" />
      </HoverCardContent>
    </HoverCard>
  );
};
