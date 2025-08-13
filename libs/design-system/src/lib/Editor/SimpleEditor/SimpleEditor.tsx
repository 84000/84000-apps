'use client';

import { Content, EditorContent, UseEditorOptions } from '@tiptap/react';
import { useBlockEditor, useDefaultExtensions } from '../BlockEditor/hooks';
import { MainBubbleMenu } from '../menus/MainBubbleMenu';

export const SimpleEditor = ({
  content,
  isEditable,
  onUpdate,
  onCreate,
}: UseEditorOptions & {
  content: Content;
  isEditable?: boolean;
}) => {
  const { extensions } = useDefaultExtensions();
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate,
    onUpdate,
  });
  return (
    <div className="relative flex flex-col flex-1">
      <EditorContent className="flex-1" editor={editor} />
      <MainBubbleMenu editor={editor} />
    </div>
  );
};

export default SimpleEditor;
