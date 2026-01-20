import { Button } from '@design-system';
import { Editor } from '@tiptap/core';
import { GlobeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { HoverInputField } from '../HoverInputField';
import { findMarkByUuid } from '../../util';
import { useHoverCard } from '../../../shared/HoverCardProvider';

const EDITOR_UPDATE_DELAY_MS = 100;

export const LinkHoverContent = ({
  uuid,
  href,
  editor,
  anchor,
}: {
  uuid: string;
  href: string;
  editor: Editor;
  anchor: HTMLElement;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { close } = useHoverCard();

  const deleteLink = useCallback(() => {
    setIsEditing(false);
    close();

    setTimeout(() => {
      const range = findMarkByUuid({ editor, uuid, markType: 'link' });
      if (!range) {
        console.warn('Link mark not found in the document.');
        return;
      }

      const { from, to, mark } = range;
      const { tr } = editor.state;
      tr.removeMark(from, to, mark.type);
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, close]);

  const updateLink = useCallback(
    (newHref: string) => {
      setIsEditing(false);
      close();

      setTimeout(() => {
        const range = findMarkByUuid({ editor, uuid, markType: 'link' });
        if (!range) {
          console.warn('Link mark not found in the document.');
          return;
        }

        const { from, to, mark } = range;
        const { tr } = editor.state;
        tr.removeMark(from, to, mark.type);
        tr.addMark(from, to, mark.type.create({ ...mark.attrs, href: newHref }));
        editor.view.dispatch(tr);

        // Update the DOM attribute directly for immediate feedback
        anchor.setAttribute('href', newHref);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, uuid, anchor, close],
  );

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-72">
      {isEditing ? (
        <HoverInputField
          type="link"
          attr="href"
          valueRef={href}
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
            {href}
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
    </div>
  );
};
