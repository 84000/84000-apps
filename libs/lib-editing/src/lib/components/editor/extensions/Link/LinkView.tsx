import {
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  LINK_STYLE,
} from '@design-system';
import { MarkViewContent, MarkViewProps } from '@tiptap/react';
import { GlobeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { findMarkByUuid } from '../../util';
import { HoverInputField } from '../HoverInputField';

const EDITOR_UPDATE_DELAY_MS = 100;

export const LinkView = ({ mark, editor, updateAttributes }: MarkViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const deleteLink = useCallback(() => {
    setIsOpen(false);
    setIsEditing(false);

    setTimeout(() => {
      const range = findMarkByUuid({ editor, mark });
      if (!range) {
        console.warn('Link mark not found in the document.');
        return;
      }

      const { from, to } = range;
      const { tr } = editor.state;
      tr.removeMark(from, to, mark.type);
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [mark, editor]);

  const updateLink = useCallback(
    (href: string) => {
      setIsOpen(false);
      setIsEditing(false);

      setTimeout(() => {
        updateAttributes?.({ href });
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [updateAttributes],
  );

  const Content = <MarkViewContent className={LINK_STYLE} />;

  if (!editor.isEditable) {
    return Content;
  }

  return (
    <HoverCard open={isOpen} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <Link href={mark.attrs.href} target="_blank" rel="noreferrer">
          {Content}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="flex justify-between gap-2 p-2 w-fit max-w-72"
      >
        {isEditing ? (
          <HoverInputField
            type="link"
            attr="href"
            valueRef={mark.attrs.href}
            placeholder="Add link..."
            onSubmit={(value) => {
              if (value) {
                updateLink(value);
              } else {
                deleteLink();
              }
              setIsEditing(false);
            }}
          />
        ) : (
          <>
            <GlobeIcon className="text-muted-foreground my-auto size-4" />
            <span className="truncate text-muted-foreground text-sm my-auto">
              {mark.attrs.href}
            </span>
            <span className="flex-grow" />
            <Button
              variant="ghost"
              size="icon"
              className="size-6 [&_svg]:size-4"
              onClick={() => setIsEditing(true)}
            >
              <PencilIcon className="text-primary my-auto" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 [&_svg]:size-4"
              onClick={deleteLink}
            >
              <Trash2Icon className="text-destructive my-auto" />
            </Button>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
