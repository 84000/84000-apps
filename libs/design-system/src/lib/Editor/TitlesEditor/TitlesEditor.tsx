'use client';

import { EditorContent } from '@tiptap/react';
import { BlockEditorContent, useBlockEditor } from '../BlockEditor';
import { useTitleExtensions } from './hooks/useTitleExtensions';
import { EmptyBubbleMenu } from '../menus/EmptyBubbleMenu';

export type TitlesEditorContentItem = BlockEditorContent & {
  attrs?: {
    uuid?: string | null;
    class?: string | null;
    type?: string | null;
    sort?: number | null;
  };
};

export type TitlesEditorContent =
  | TitlesEditorContentItem[]
  | TitlesEditorContentItem;

export const TitlesEditor = ({
  content,
  isEditable = true,
}: {
  content: TitlesEditorContent;
  isEditable?: boolean;
}) => {
  const { extensions } = useTitleExtensions();
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
  });
  return (
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <EmptyBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default TitlesEditor;
