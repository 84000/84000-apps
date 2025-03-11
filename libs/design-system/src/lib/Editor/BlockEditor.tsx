'use client';

import { Content, EditorContent } from '@tiptap/react';
import { useBlockEditor } from './hooks/useBlockEditor';
import { useExtensions } from './hooks/useExtensions';

export const BlockEditor = ({
  content,
  isEditable = true,
}: {
  content: Content;
  isEditable?: boolean;
}) => {
  const { extensions } = useExtensions();
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
  });
  return (
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full overflow-hidden">
        <EditorContent className="flex-1 overflow-y-auto" editor={editor} />
      </div>
    </div>
  );
};

export default BlockEditor;
