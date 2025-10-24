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
import { TranslationHoverCard } from './extensions/TranslationHoverCard';

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

  const { anchor, uuid, cardType, setCard } = useHover({
    typeMap: {
      glossaryInstance: 'glossary',
      endNoteLink: 'endNote',
    },
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

  const renderCard = (uuid: string, type: string) => {
    if (type === 'glossaryInstance' && fetchGlossaryInstance) {
      return <GlossaryInstance uuid={uuid} fetch={fetchGlossaryInstance} />;
    }
    if (type === 'endNoteLink' && fetchEndNote) {
      return <EndNoteLink uuid={uuid} fetch={fetchEndNote} />;
    }
    return null;
  };

  return (
    <>
      <div ref={editorRef} className={cn('flex h-full', className)}>
        <div className="relative flex flex-col flex-1 h-full">
          <EditorContent className="flex-1" editor={editor} />
          <TranslationBubbleMenu editor={editor} />
        </div>
      </div>
      {anchor && uuid && cardType && fetchGlossaryInstance && fetchEndNote && (
        <TranslationHoverCard
          className={cn(
            cardType === 'endNoteLink' && 'w-120 max-h-96 m-2 overflow-auto',
            cardType === 'glossaryInstance' &&
              'w-120 lg:w-4xl max-h-100 m-2 overflow-auto',
          )}
          anchor={anchor}
          setCard={setCard}
        >
          {renderCard(uuid, cardType)}
        </TranslationHoverCard>
      )}
    </>
  );
};

export default TranslationEditor;
