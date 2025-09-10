'use client';

import { EditorContent, Content } from '@tiptap/react';
import type { XmlFragment } from 'yjs';
import { useBlockEditor } from '../BlockEditor';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';
import { TranslationBubbleMenu } from './menu/TranslationBubbleMenu';

export type TranslationEditorContentItem = Content & {
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
  fragment,
  isEditable = true,
  onCreate,
  fetchEndNote,
}: {
  content: TranslationEditorContent;
  fragment?: XmlFragment;
  isEditable?: boolean;
  onCreate?: () => void;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
}) => {
  const { extensions } = useTranslationExtensions({ fragment, fetchEndNote });
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate,
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
