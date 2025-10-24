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
import EndNoteLink from './extensions/EndNoteLink/EndNoteLink';

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

  const {
    anchor: glossaryAnchor,
    uuid: glossaryUuid,
    setCard: setGlossaryCard,
  } = useHover({
    type: 'glossaryInstance',
    attribute: 'glossary',
    editorRef,
  });

  const {
    anchor: endnoteAnchor,
    uuid: endnoteUuid,
    setCard: setNoteCard,
  } = useHover({
    type: 'endNoteLink',
    attribute: 'endNote',
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
      {glossaryAnchor && glossaryUuid && fetchGlossaryInstance && (
        <GlossaryInstance
          anchor={glossaryAnchor}
          fetch={fetchGlossaryInstance}
          uuid={glossaryUuid}
          setCard={setGlossaryCard}
        />
      )}
      {endnoteAnchor && endnoteUuid && fetchEndNote && (
        <EndNoteLink
          anchor={endnoteAnchor}
          fetch={fetchEndNote}
          uuid={endnoteUuid}
          setCard={setNoteCard}
        />
      )}
    </>
  );
};

export default TranslationEditor;
