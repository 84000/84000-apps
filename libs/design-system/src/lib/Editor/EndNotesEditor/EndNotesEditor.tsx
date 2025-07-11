'use client';

import { EditorContent, JSONContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { useEndNotesExtensions } from './hooks/useEndNotesExtensions';
import { EndNotesBubbleMenu } from './menu/EndNotesBubbleMenu';

export const EndNotesEditor = ({
  content,
  isEditable = true,
}: {
  content: JSONContent;
  isEditable?: boolean;
}) => {
  const { extensions } = useEndNotesExtensions();
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
