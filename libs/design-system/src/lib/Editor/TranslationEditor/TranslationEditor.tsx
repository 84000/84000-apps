'use client';

import { EditorContent, JSONContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { MainBubbleMenu } from '../menus/MainBubbleMenu';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';

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

export const TranslationEditor = ({
  content,
  isEditable = true,
}: {
  content: TranslationEditorContent;
  isEditable?: boolean;
}) => {
  const { extensions } = useTranslationExtensions();
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

export default TranslationEditor;
