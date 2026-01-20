import { Button } from '@design-system';
import { Editor } from '@tiptap/core';
import { FileTextIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { HoverInputField } from '../HoverInputField';
import { useHoverCard } from '../../../shared/HoverCardProvider';
import { findEndnoteMarkByUuid } from '../../util';

const EDITOR_UPDATE_DELAY_MS = 100;

export const EndNoteLinkHoverContent = ({
  uuid,
  endNote,
  editor,
  anchor,
}: {
  uuid: string;
  endNote: string;
  editor: Editor;
  anchor: HTMLElement;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { close } = useHoverCard();

  const deleteEndNote = useCallback(() => {
    setIsEditing(false);
    close();

    setTimeout(() => {
      // Find the mark that contains this endnote by traversing up from the anchor
      const range = findEndnoteMarkByUuid({ editor, uuid });
      if (!range) {
        console.warn('EndNoteLink mark not found in the document.');
        return;
      }

      const { from, to, mark } = range;
      const { tr } = editor.state;
      tr.removeMark(from, to, mark.type);
      const notes = (mark.attrs.notes || []).filter(
        (note: { uuid: string }) => uuid !== note.uuid,
      );
      if (notes.length > 0) {
        tr.addMark(from, to, mark.type.create({ ...mark.attrs, notes }));
      }
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, anchor, close]);

  const updateEndNote = useCallback(
    (newEndNote: string) => {
      setIsEditing(false);
      close();

      setTimeout(() => {
        const range = findEndnoteMarkByUuid({ editor, uuid });
        if (!range) {
          console.warn('EndNoteLink mark not found in the document.');
          return;
        }

        const { from, to, mark } = range;
        const { tr } = editor.state;
        tr.removeMark(from, to, mark.type);
        const note = (mark.attrs.notes || []).find(
          (note: { uuid: string }) => uuid === note.uuid,
        );
        const notes = [
          ...(mark.attrs.notes || []).filter(
            (note: { uuid: string }) => uuid !== note.uuid,
          ),
          {
            ...note,
            uuid,
            endNote: newEndNote,
          },
        ];
        tr.addMark(
          from,
          to,
          mark.type.create({
            ...mark.attrs,
            notes,
          }),
        );
        editor.view.dispatch(tr);

        // Update the DOM attribute directly for immediate feedback
        anchor.setAttribute('endNote', newEndNote);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, uuid, anchor, close],
  );

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      {isEditing ? (
        <HoverInputField
          type="endNoteLink"
          attr="endNote"
          valueRef={endNote}
          placeholder="End note ID..."
          onSubmit={(value) => {
            if (value) {
              updateEndNote(value);
            } else {
              deleteEndNote();
            }
            setIsEditing(false);
          }}
        />
      ) : (
        <>
          <FileTextIcon className="text-primary my-auto size-6 [&_svg]:size-4" />
          <span className="truncate text-muted-foreground text-sm my-auto">
            {endNote}
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
            onClick={deleteEndNote}
          >
            <Trash2Icon className="text-destructive my-auto" />
          </Button>
        </>
      )}
    </div>
  );
};
