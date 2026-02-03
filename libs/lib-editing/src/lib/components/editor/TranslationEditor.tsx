'use client';

import { EditorContent } from '@tiptap/react';
import { TranslationBubbleMenu } from './menus';
import { cn } from '@lib-utils';
import { usePagination } from './PaginationProvider';
import type {
  TranslationEditorContentItem,
  TranslationEditorContent,
} from '@data-access';

// Re-export for backwards compatibility
export type { TranslationEditorContentItem, TranslationEditorContent };

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
