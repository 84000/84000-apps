import {
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  LINK_STYLE,
} from '@design-system';
import { MarkViewContent, MarkViewProps } from '@tiptap/react';
import {
  ChevronRightIcon,
  FileSymlinkIcon,
  GlobeIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { findMarkRange } from '../../util';
import Link from 'next/link';
import { InternalLinkInput } from './InternalLinkInput';

const EDITOR_UPDATE_DELAY_MS = 100;

export const InternalLinkView = ({
  mark,
  editor,
  updateAttributes,
}: MarkViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const deleteLink = useCallback(() => {
    setIsOpen(false);
    setIsEditing(false);

    setTimeout(() => {
      const range = findMarkRange({ editor, mark });
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

  const updateValues = useCallback(
    (type: string, entity: string) => {
      setIsOpen(false);
      setIsEditing(false);

      setTimeout(() => {
        updateAttributes?.({
          type,
          entity,
          href: `/entity/${type}/${entity}`,
        });
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [updateAttributes],
  );

  if (!editor.isEditable) {
    // TODO: support hover cards for various entity types
    return (
      <MarkViewContent
        className={LINK_STYLE}
        as="a"
        href={mark.attrs.href}
        target="_blank"
        rel="noreferrer"
      />
    );
  }

  return (
    <HoverCard open={isOpen} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <Link
          href={mark.attrs.href}
          target="_blank"
          rel="noreferrer"
          className={LINK_STYLE}
        >
          <MarkViewContent as="span" />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="flex justify-between gap-2 p-2 w-fit max-w-80"
      >
        {isEditing ? (
          <InternalLinkInput
            type={mark.attrs.type}
            uuid={mark.attrs.entity}
            onSubmit={(type, uuid) => {
              if (type && uuid) {
                updateValues(type, uuid);
              } else {
                deleteLink();
              }
              setIsEditing(false);
            }}
          />
        ) : (
          <>
            <span className="text-muted-foreground text-sm my-auto">
              {mark.attrs.type}
            </span>
            <ChevronRightIcon className="my-auto size-4" />
            <span className="truncate text-muted-foreground text-sm my-auto">
              {mark.attrs.entity}
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
