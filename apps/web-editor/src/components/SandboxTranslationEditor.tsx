'use client';

import { Passage } from '@data-access';
import {
  useBlockEditor,
  useTranslationExtensions,
  TranslationBubbleMenu,
  TranslationEditorContent,
} from '@lib-editing';
import { EditorContent } from '@tiptap/react';

export const SandboxTranslationEditor = ({
  content,
  fetchEndNote,
}: {
  content: TranslationEditorContent;
  fetchEndNote(uuid: string): Promise<Passage>;
}) => {
  const { extensions } = useTranslationExtensions({
    fetchEndNote,
  });

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
