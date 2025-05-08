'use client';

import { EditorContent, JSONContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { MainBubbleMenu } from '../menus/MainBubbleMenu';
import { useTitleExtensions } from './hooks/useTitleExtensions';

export type TitlesEditorContentItem = JSONContent & {
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
        <MainBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default TitlesEditor;
