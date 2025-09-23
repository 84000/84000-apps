'use client';

import { GlossaryTermInstance, Passage } from '@data-access';
import type { Editor } from '@tiptap/react';
import type { XmlFragment } from 'yjs';
import { useEffect, useState } from 'react';
import {
  TranslationEditor,
  TranslationEditorContent,
} from './TranslationEditor';
import { blocksFromTranslationBody } from '../../block';

export const PassagesEditor = ({
  passages,
  fragment,
  className,
  onCreate,
  fetchEndNote,
  fetchGlossaryInstance,
}: {
  passages: Passage[];
  fragment: XmlFragment;
  className?: string;
  onCreate?: (params: { editor: Editor }) => void;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryInstance?: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const [content, setContent] = useState<TranslationEditorContent>([]);

  useEffect(() => {
    const blocks = blocksFromTranslationBody(passages);
    setContent(blocks);
  }, [passages]);

  return (
    <TranslationEditor
      content={content}
      className={className}
      fragment={fragment}
      onCreate={onCreate}
      fetchEndNote={fetchEndNote}
      fetchGlossaryInstance={fetchGlossaryInstance}
    />
  );
};
