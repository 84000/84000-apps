'use client';

import { EditorContent, JSONContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';
import { TranslationBubbleMenu } from './menu/TranslationBubbleMenu';

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
        <TranslationBubbleMenu editor={editor} />
      </div>
    </div>
  );
};

export default TranslationEditor;
