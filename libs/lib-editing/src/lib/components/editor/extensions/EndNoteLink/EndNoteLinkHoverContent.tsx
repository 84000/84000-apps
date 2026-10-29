'use client';

import { Button } from '@eightyfourthousand/design-system';
import { Editor } from '@tiptap/core';
import {
  AlertCircleIcon,
  AsteriskIcon,
  Loader2Icon,
  UnlinkIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '../../../shared/NavigationContext';
import { findEndnoteMarkByUuid } from '../../util';
import { useEditorState } from '../../EditorProvider';
import { useHoverCardEditor, type EditorRequest } from '../useHoverCardEditor';

export const EndNoteLinkHoverContent = ({
  uuid,
  endNote,
  editor,
  requestEditor,
  close,
  setHoverCardEditing,
  editable,
}: {
  uuid: string;
  endNote: string;
  editor?: Editor;
  requestEditor: EditorRequest;
  anchor: HTMLElement;
  close: () => void;
  setHoverCardEditing: (isEditing: boolean) => void;
  /** Offer the actions that edit the document. */
  editable: boolean;
}) => {
  const [label, setLabel] = useState<string | undefined>();
  const withEditor = useHoverCardEditor(editor, requestEditor);
  const [fetchState, setFetchState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const { deleteEndnote } = useEditorState();
  const { fetchEndNote } = useNavigation();

  // With no endnote to resolve there is nothing to load, so this is derived
  // rather than pushed into state from the effect below.
  const labelState = !endNote ? 'error' : fetchState;

  useEffect(() => {
    if (!endNote) {
      return;
    }

    // Shows the spinner again when the endnote changes; the label resolves
    // over the network below.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before an async fetch
    setFetchState('loading');
    fetchEndNote(endNote).then((passage) => {
      if (passage?.label) {
        setLabel(passage.label);
        setFetchState('loaded');
      } else {
        setFetchState('error');
      }
    });
  }, [endNote, fetchEndNote]);

  const removeLink = useCallback(() => {
    setHoverCardEditing(false);
    close();

    withEditor((editor) => {
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
    });
  }, [withEditor, uuid, close, setHoverCardEditing]);

  const deleteEndnoteAndLink = useCallback(async () => {
    setHoverCardEditing(false);
    close();

    // The stack removes the endnote and every link to it as one change.
    await deleteEndnote(endNote);
  }, [endNote, deleteEndnote, close, setHoverCardEditing]);

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      <AsteriskIcon className="text-primary my-auto size-6 [&_svg]:size-4" />
      {labelState === 'loading' && (
        <Loader2Icon className="text-muted-foreground my-auto size-4 animate-spin" />
      )}
      {labelState === 'error' && (
        <AlertCircleIcon className="text-destructive my-auto size-4" />
      )}
      {labelState === 'loaded' && (
        <span className="truncate text-muted-foreground text-sm my-auto">
          {label}
        </span>
      )}
      <span className="flex-grow" />
      {editable && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            title="Remove link"
            onClick={removeLink}
          >
            <UnlinkIcon className="text-destructive my-auto" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            title="Delete endnote"
            onClick={deleteEndnoteAndLink}
          >
            <Trash2Icon className="text-destructive my-auto" />
          </Button>
        </>
      )}
    </div>
  );
};
