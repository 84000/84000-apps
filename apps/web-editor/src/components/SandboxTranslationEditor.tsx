'use client';

import {
  useBlockEditor,
  useTranslationExtensions,
  TranslationBubbleMenu,
  TranslationEditorContent,
} from '@lib-editing';
import { EditorContent } from '@tiptap/react';

export const SandboxTranslationEditor = ({
  content,
}: {
  content: TranslationEditorContent;
}) => {
  const { extensions } = useTranslationExtensions();

  const { editor } = useBlockEditor({
    extensions,
    content,
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
