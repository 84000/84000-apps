'use client';

import { GlossaryTermInstance, Passage } from '@data-access';
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
  onCreate,
  fetchEndNote,
  fetchGlossaryInstance,
}: {
  passages: Passage[];
  fragment: XmlFragment;
  onCreate?: () => void;
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
      fragment={fragment}
      onCreate={onCreate}
      fetchEndNote={fetchEndNote}
      fetchGlossaryInstance={fetchGlossaryInstance}
    />
  );
};
