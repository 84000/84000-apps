'use client';

import { EditorContent, JSONContent } from '@tiptap/react';
import { useBlockEditor } from './hooks/useBlockEditor';
import { useExtensions } from './hooks/useExtensions';
import { MainBubbleMenu } from './menus/MainBubbleMenu';

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
}: {
  content: BlockEditorContent;
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
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <MainBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default BlockEditor;
