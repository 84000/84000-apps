'use client';

import { Button } from '@design-system';
import { Editor } from '@tiptap/core';
import {
  AlertCircleIcon,
  AsteriskIcon,
  Loader2Icon,
  UnlinkIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useHoverCard } from '../../../shared/HoverCardProvider';
import { useNavigation } from '../../../shared';
import { findEndnoteMarkByUuid, findPassageNode } from '../../util';
import { useEditorState } from '../../EditorProvider';
import { deleteEndnotePassageNode } from './endnote-utils';

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
  const [labelState, setLabelState] = useState<
    'loading' | 'loaded' | 'error'
  >('loading');
  const { close, setIsEditing } = useHoverCard();
  const { getEditor } = useEditorState();
  const { fetchEndNote } = useNavigation();

  useEffect(() => {
    if (!endNote) {
      setLabelState('error');
      return;
    }

    // Try the local endnotes editor first — works for unpersisted passages too
    const endnotesEditor = getEditor('endnotes');
    if (endnotesEditor) {
      const found = findPassageNode(endnotesEditor, endNote);
      if (found?.node.attrs.label) {
        setLabel(found.node.attrs.label);
        setLabelState('loaded');
        return;
      }
    }

    // Fall back to network fetch
    setLabelState('loading');
    fetchEndNote(endNote).then((passage) => {
      if (passage?.label) {
        setLabel(passage.label);
        setLabelState('loaded');
      } else {
        setLabelState('error');
      }
    });
  }, [endNote, fetchEndNote, getEditor]);

  const removeLink = useCallback(() => {
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
      const notes = (mark.attrs.notes || []).filter(
        (note: { uuid: string }) => uuid !== note.uuid,
      );
      if (notes.length > 0) {
        tr.addMark(from, to, mark.type.create({ ...mark.attrs, notes }));
      }
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, close, setIsEditing]);

  const deleteEndnoteAndLink = useCallback(() => {
    setIsEditing(false);
    close();

    setTimeout(() => {
      const endnotesEditor = getEditor('endnotes');
      if (endnotesEditor) {
        deleteEndnotePassageNode(endnotesEditor, endNote);
      }
    }, EDITOR_UPDATE_DELAY_MS);
  }, [endNote, getEditor, close, setIsEditing]);

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
    </div>
  );
};
