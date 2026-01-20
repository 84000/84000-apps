import { Button } from '@design-system';
import { Editor } from '@tiptap/core';
import { ChevronRightIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { InternalLinkInput } from './InternalLinkInput';
import { findMarkByUuid } from '../../util';
import { useHoverCard } from '../../../shared/HoverCardProvider';

const EDITOR_UPDATE_DELAY_MS = 100;

export const InternalLinkHoverContent = ({
  uuid,
  entityType,
  entity,
  editor,
  anchor,
}: {
  uuid: string;
  entityType: string;
  entity: string;
  editor: Editor;
  anchor: HTMLElement;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { close } = useHoverCard();

  const deleteLink = useCallback(() => {
    setIsEditing(false);
    close();

    setTimeout(() => {
      const range = findMarkByUuid({ editor, uuid, markType: 'internalLink' });
      if (!range) {
        console.warn('InternalLink mark not found in the document.');
        return;
      }

      const { from, to, mark } = range;
      const { tr } = editor.state;
      tr.removeMark(from, to, mark.type);
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, close]);

  const updateValues = useCallback(
    (newType: string, newEntity: string) => {
      setIsEditing(false);
      close();

      setTimeout(() => {
        const range = findMarkByUuid({
          editor,
          uuid,
          markType: 'internalLink',
        });
        if (!range) {
          console.warn('InternalLink mark not found in the document.');
          return;
        }

        const { from, to, mark } = range;
        const newHref = `/entity/${newType}/${newEntity}`;
        const { tr } = editor.state;
        tr.removeMark(from, to, mark.type);
        tr.addMark(
          from,
          to,
          mark.type.create({
            ...mark.attrs,
            type: newType,
            entity: newEntity,
            href: newHref,
          }),
        );
        editor.view.dispatch(tr);

        // Update the DOM attributes directly for immediate feedback
        anchor.setAttribute('entity-type', newType);
        anchor.setAttribute('entity', newEntity);
        anchor.setAttribute('href', newHref);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, uuid, anchor, close],
  );

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      {isEditing ? (
        <InternalLinkInput
          type={entityType}
          uuid={entity}
          onSubmit={(type, entityVal) => {
            if (type && entityVal) {
              updateValues(type, entityVal);
            } else {
              deleteLink();
            }
            setIsEditing(false);
          }}
        />
      ) : (
        <>
          <span className="text-primary text-sm my-auto">{entityType}</span>
          <ChevronRightIcon className="my-auto size-4" />
          <span className="truncate text-muted-foreground text-sm my-auto">
            {entity}
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
