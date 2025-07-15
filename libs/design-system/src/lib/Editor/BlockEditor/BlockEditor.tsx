'use client';

import { EditorContent, JSONContent, UseEditorOptions } from '@tiptap/react';
import { useBlockEditor, useDefaultExtensions } from './hooks';
import { MainBubbleMenu } from '../menus/MainBubbleMenu';

export type BlockEditorContentItem = JSONContent & {
  attrs?: {
    uuid?: string | null;
    class?: string | null;
    type?: string | null;
    sort?: number | null;
  };
};

export type BlockEditorContent =
  | BlockEditorContentItem[]
  | BlockEditorContentItem;

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
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <MainBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default BlockEditor;
