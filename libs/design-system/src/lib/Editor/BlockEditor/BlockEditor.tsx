'use client';

import { Doc } from 'yjs';
import { EditorContent, JSONContent } from '@tiptap/react';
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
  doc,
  isEditable = true,
}: {
  content: BlockEditorContent;
  doc: Doc;
  isEditable?: boolean;
}) => {
  const { extensions } = useDefaultExtensions({ doc });
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
