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
import { findEndnoteMarkByUuid, findPassageNode } from '../../util';
import { useEditorState } from '../../EditorProvider';
import {
  deleteEndnotePassageNode,
  removeAllEndnoteLinksForPassage,
} from './endnote-utils';

const EDITOR_UPDATE_DELAY_MS = 100;

export const EndNoteLinkHoverContent = ({
  uuid,
  endNote,
  editor,
  close,
  setHoverCardEditing,
}: {
  uuid: string;
  endNote: string;
  editor: Editor;
  anchor: HTMLElement;
  close: () => void;
  setHoverCardEditing: (isEditing: boolean) => void;
}) => {
  const [label, setLabel] = useState<string | undefined>();
  const [fetchState, setFetchState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const { getEditor } = useEditorState();
  const { fetchEndNote } = useNavigation();

  // With no endnote to resolve there is nothing to load, so this is derived
  // rather than pushed into state from the effect below.
  const labelState = !endNote ? 'error' : fetchState;

  useEffect(() => {
    if (!endNote) {
      return;
    }

    // Try the local endnotes editor first — works for unpersisted passages too
    const endnotesEditor = getEditor('endnotes');
    if (endnotesEditor) {
      const found = findPassageNode(endnotesEditor, endNote);
      if (found?.node.attrs.label) {
        // A synchronous read of live TipTap document state, which cannot be
        // derived during render without reading the editor impurely. The other
        // branch resolves over the network, so both paths land in state here.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous read of external editor state
        setLabel(found.node.attrs.label);
        setFetchState('loaded');
        return;
      }
    }

    // Fall back to network fetch
    setFetchState('loading');
    fetchEndNote(endNote).then((passage) => {
      if (passage?.label) {
        setLabel(passage.label);
        setFetchState('loaded');
      } else {
        setFetchState('error');
      }
    });
  }, [endNote, fetchEndNote, getEditor]);

  const removeLink = useCallback(() => {
    setHoverCardEditing(false);
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
  }, [editor, uuid, close, setHoverCardEditing]);

  const deleteEndnoteAndLink = useCallback(() => {
    setHoverCardEditing(false);
    close();

    setTimeout(() => {
      const endnotesEditor = getEditor('endnotes');
      if (endnotesEditor) {
        deleteEndnotePassageNode(endnotesEditor, endNote);
      }

      // Remove the referencing links directly rather than relying solely on
      // the debounced observer in TranslationBuilder, which can miss the
      // deletion if it races a save/navigation. The observer still backstops
      // other deletion paths (backspace, merge) and renumbers labels.
      const frontEditor = getEditor('front');
      const translationEditor = getEditor('translation');
      if (frontEditor) {
        removeAllEndnoteLinksForPassage(frontEditor, endNote);
      }
      if (translationEditor) {
        removeAllEndnoteLinksForPassage(translationEditor, endNote);
      }
    }, EDITOR_UPDATE_DELAY_MS);
  }, [endNote, getEditor, close, setHoverCardEditing]);

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
