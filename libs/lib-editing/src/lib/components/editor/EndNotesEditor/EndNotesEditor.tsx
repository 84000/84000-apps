'use client';

import type { XmlFragment } from 'yjs';
import { Content, EditorContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { useEndNotesExtensions } from './hooks/useEndNotesExtensions';
import { EndNotesBubbleMenu } from './menu/EndNotesBubbleMenu';

export const EndNotesEditor = ({
  content,
  fragment,
  isEditable = true,
}: {
  content: Content;
  fragment?: XmlFragment;
  isEditable?: boolean;
}) => {
  const { extensions } = useEndNotesExtensions({ fragment });
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
  });

  return (
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <EndNotesBubbleMenu editor={editor} />
      </div>
    </div>
  );
};
