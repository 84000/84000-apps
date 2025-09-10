'use client';

import { Passage } from '@data-access';
import { TranslationEditor } from '@design-system';
import type { TranslationEditorContent } from '@design-system';
import { blocksFromTranslationBody } from '@lib-editing';
import type { XmlFragment } from 'yjs';
import { useEffect, useState } from 'react';

export const TranslationBodyEditor = ({
  body,
  fragment,
  onCreate,
  fetchEndNote,
}: {
  body: Passage[];
  fragment: XmlFragment;
  onCreate?: () => void;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
}) => {
  const [content, setContent] = useState<TranslationEditorContent>([]);

  useEffect(() => {
    const blocks = blocksFromTranslationBody(body);
    setContent(blocks);
  }, [body]);

  return (
    <TranslationEditor
      content={content}
      fragment={fragment}
      onCreate={onCreate}
      fetchEndNote={fetchEndNote}
    />
  );
};
