import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@design-system';
import { Editor } from '@tiptap/core';
import { FileTextIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useHoverCard } from '../../../shared/HoverCardProvider';
import { useNavigation } from '../../../shared';
import { findEndnoteMarkByUuid } from '../../util';
import { useEditorState } from '../../EditorProvider';
import {
  removeAllEndnoteLinksForPassage,
  deleteEndnotePassageNode,
} from './endnote-utils';

const EDITOR_UPDATE_DELAY_MS = 100;

export const EndNoteLinkHoverContent = ({
  uuid,
  endNote,
  editor,
}: {
  uuid: string;
  endNote: string;
  editor: Editor;
  anchor: HTMLElement;
}) => {
  const [label, setLabel] = useState<string | undefined>();
  const { close } = useHoverCard();
  const { getEditor } = useEditorState();
  const { fetchEndNote } = useNavigation();

  useEffect(() => {
    if (!endNote) return;
    fetchEndNote(endNote).then((passage) => {
      if (passage?.label) {
        setLabel(passage.label);
      }
    });
  }, [endNote, fetchEndNote]);

  const removeLink = useCallback(() => {
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
      const notes = (mark.attrs.notes || []).filter(
        (note: { uuid: string }) => uuid !== note.uuid,
      );
      if (notes.length > 0) {
        tr.addMark(from, to, mark.type.create({ ...mark.attrs, notes }));
      }
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, close]);

  const deleteEndnoteAndLink = useCallback(() => {
    close();

    setTimeout(() => {
      removeAllEndnoteLinksForPassage(editor, endNote);

      const endnotesEditor = getEditor('endnotes');
      if (endnotesEditor) {
        deleteEndnotePassageNode(endnotesEditor, endNote);
      }
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, endNote, getEditor, close]);

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      <FileTextIcon className="text-primary my-auto size-6 [&_svg]:size-4" />
      <span className="truncate text-muted-foreground text-sm my-auto">
        {label || endNote}
      </span>
      <span className="flex-grow" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
          >
            <Trash2Icon className="text-destructive my-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={removeLink}>
            Remove link
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={deleteEndnoteAndLink}
            className="text-destructive"
          >
            Delete endnote
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
