'use client';

import {
  useBlockEditor,
  useTranslationExtensions,
  TranslationBubbleMenu,
  TranslationEditorContent,
} from '@lib-editing';
import { EditorContent } from '@tiptap/react';
import { useSandbox } from './SandboxProvider';
import { useEffect } from 'react';

export const SandboxTranslationEditor = ({
  content,
}: {
  content: TranslationEditorContent;
}) => {
  const { setEditor, setContent } = useSandbox();
  const { extensions } = useTranslationExtensions();
  const { editor } = useBlockEditor({
    extensions,
    content,
  });

  useEffect(() => {
    setEditor(editor);
  }, [editor, setEditor]);

  useEffect(() => {
    setContent(content);
  }, [content, setContent]);

  return (
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <TranslationBubbleMenu editor={editor} />
      </div>
    </div>
  );
};
