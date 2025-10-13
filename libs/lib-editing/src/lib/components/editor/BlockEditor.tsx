'use client';

import { Content, EditorContent, UseEditorOptions } from '@tiptap/react';
import { useBlockEditor, useDefaultExtensions } from './hooks';
import { MainBubbleMenu } from './menus/MainBubbleMenu';

export type BlockEditorContent = Content;

export const BlockEditor = ({
  content,
  isEditable = true,
  onUpdate,
  onCreate,
}: UseEditorOptions & {
  content: BlockEditorContent;
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
    <div className="relative flex flex-col flex-1 h-full">
      <EditorContent className="flex-1" editor={editor} />
      <MainBubbleMenu editor={editor} />
    </div>
  );
};

export default BlockEditor;
