'use client';

import { EditorContent, JSONContent } from '@tiptap/react';
import { TranslationBubbleMenu } from './menus';
import { cn } from '@lib-utils';
import { usePagination } from './PaginationProvider';

export type TranslationEditorContentItem = JSONContent & {
  attrs?: {
    uuid?: string | null;
    class?: string | null;
    type?: string | null;
    sort?: number | null;
  };
};

export type TranslationEditorContent =
  | TranslationEditorContentItem[]
  | TranslationEditorContentItem;

export const TranslationEditor = ({ className }: { className?: string }) => {
  const { editor } = usePagination();

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('flex h-full', className)}>
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <TranslationBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default TranslationEditor;
