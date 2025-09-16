'use client';

import { EditorContent, Content } from '@tiptap/react';
import type { XmlFragment } from 'yjs';
import { useBlockEditor } from '../BlockEditor';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';
import { TranslationBubbleMenu } from './menu/TranslationBubbleMenu';
import { GlossaryTermInstance } from '@data-access';
import { cn } from '@lib-utils';

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
  className,
  onCreate,
  fetchEndNote,
  fetchGlossaryInstance,
}: {
  content: TranslationEditorContent;
  fragment?: XmlFragment;
  isEditable?: boolean;
  className?: string;
  onCreate?: () => void;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryInstance?: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const { extensions } = useTranslationExtensions({
    fragment,
    fetchEndNote,
    fetchGlossaryInstance,
  });
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate,
  });
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
