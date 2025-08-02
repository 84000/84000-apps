'use client';

import { Passage } from '@data-access';
import { EndNotesEditor } from '@design-system';
import type { BlockEditorContent } from '@design-system';
import { blocksFromTranslationBody } from '@lib-editing';
import type { XmlFragment } from 'yjs';
import { useEffect, useState } from 'react';

export const EndnoteBodyEditor = ({
  body,
  fragment,
}: {
  body: Passage[];
  fragment?: XmlFragment;
}) => {
  const [content, setContent] = useState<BlockEditorContent>([]);

  useEffect(() => {
    const blocks = blocksFromTranslationBody(body);
    setContent(blocks);
  }, [body]);

  return <EndNotesEditor content={content} fragment={fragment} />;
};
