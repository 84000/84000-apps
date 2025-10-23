'use client';

import { EditorContent, JSONContent, Editor } from '@tiptap/react';
import type { XmlFragment } from 'yjs';
import { useBlockEditor, useTranslationExtensions } from './hooks';
import { TranslationBubbleMenu } from './menus';
import { GlossaryTermInstance } from '@data-access';
import { cn } from '@lib-utils';
import { useRef } from 'react';
import { useHover } from './hooks/useHoverCard';
import { GlossaryInstance } from './extensions/GlossaryInstance/GlossaryInstance';

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
  onCreate?: (params: { editor: Editor }) => void;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryInstance?: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const { anchor, uuid } = useHover({
    type: 'glossaryInstance',
    attribute: 'glossary',
    editorRef,
  });

  const { extensions } = useTranslationExtensions({
    fragment,
    fetchEndNote,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
    onCreate,
  });

  return (
    <>
      <div ref={editorRef} className={cn('flex h-full', className)}>
        <div className="relative flex flex-col flex-1 h-full">
          <EditorContent className="flex-1" editor={editor} />
          <TranslationBubbleMenu editor={editor} />
        </div>
      </div>
      {anchor && uuid && fetchGlossaryInstance && (
        <GlossaryInstance
          anchor={anchor}
          fetch={fetchGlossaryInstance}
          uuid={uuid}
        />
      )}
    </>
  );
};

export default TranslationEditor;
