import { Button } from '@design-system';
import { Editor } from '@tiptap/core';
import { FileTextIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { HoverInputField } from '../HoverInputField';
import { useHoverCard } from '../../../shared/HoverCardProvider';

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
      const markContainer = anchor.closest('span');
      if (!markContainer) {
        console.warn('EndNoteLink container not found.');
        return;
      }

      // Find the position in the editor
      const { state } = editor;
      const { doc, tr } = state;

      let found = false;

      doc.descendants((node, pos) => {
        if (found) return false;

        for (const m of node.marks) {
          if (m.type.name === 'endNoteLink') {
            const notes = m.attrs.notes || [];
            const noteIndex = notes.findIndex(
              (n: { uuid: string }) => n.uuid === uuid,
            );
            if (noteIndex !== -1) {
              const from = tr.mapping.map(pos);
              const to = from + node.nodeSize;

              if (notes.length === 1) {
                // Remove the entire mark if this is the only note
                tr.removeMark(from, to, m.type);
              } else {
                // Remove just this note from the array
                const newNotes = notes.filter(
                  (_: unknown, i: number) => i !== noteIndex,
                );
                tr.removeMark(from, to, m.type);
                tr.addMark(
                  from,
                  to,
                  m.type.create({ ...m.attrs, notes: newNotes }),
                );
              }

              found = true;
              return false;
            }
          }
        }
        return true;
      });

      if (found) {
        editor.view.dispatch(tr);
      } else {
        console.warn('EndNoteLink mark not found in the document.');
      }
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, anchor, close]);

  const updateEndNote = useCallback(
    (newEndNote: string) => {
      setIsEditing(false);
      close();

      setTimeout(() => {
        const { state } = editor;
        const { doc, tr } = state;

        let found = false;

        doc.descendants((node, pos) => {
          if (found) return false;

          for (const m of node.marks) {
            if (m.type.name === 'endNoteLink') {
              const notes = m.attrs.notes || [];
              const noteIndex = notes.findIndex(
                (n: { uuid: string }) => n.uuid === uuid,
              );
              if (noteIndex !== -1) {
                const from = tr.mapping.map(pos);
                const to = from + node.nodeSize;

                // Update the note in the array
                const newNotes = [...notes];
                newNotes[noteIndex] = {
                  ...newNotes[noteIndex],
                  endNote: newEndNote,
                };

                tr.removeMark(from, to, m.type);
                tr.addMark(
                  from,
                  to,
                  m.type.create({ ...m.attrs, notes: newNotes }),
                );

                found = true;

                // Update the DOM attribute directly for immediate feedback
                anchor.setAttribute('endNote', newEndNote);

                return false;
              }
            }
          }
          return true;
        });

        if (found) {
          editor.view.dispatch(tr);
        } else {
          console.warn('EndNoteLink mark not found in the document.');
        }
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
