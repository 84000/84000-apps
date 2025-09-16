'use client';

import { EditorContent } from '@tiptap/react';
import { BlockEditorContent, useBlockEditor } from '../BlockEditor';
import { useTitleExtensions } from './hooks/useTitleExtensions';
import { EmptyBubbleMenu } from '../menus/EmptyBubbleMenu';
import { cn } from '@lib-utils';

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
  className,
  isEditable = true,
}: {
  content: TitlesEditorContent;
  className?: string;
  isEditable?: boolean;
}) => {
  const { extensions } = useTitleExtensions();
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
  });
  return (
    <div className={cn('flex h-full', className)}>
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <EmptyBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default TitlesEditor;
