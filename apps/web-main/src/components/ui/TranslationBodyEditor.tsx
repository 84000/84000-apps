'use client';

import { Body } from '@data-access';
import { TranslationEditor } from '@design-system';
import type { BlockEditorContent } from '@design-system';
import { blocksFromTranslationBody } from '@lib-editing';
import { useEffect, useState } from 'react';

export const TranslationBodyEditor = ({ body }: { body: Body }) => {
  const [content, setContent] = useState<BlockEditorContent>([]);

  useEffect(() => {
    const blocks = blocksFromTranslationBody(body);
    setContent(blocks);
  }, [body]);

  return <TranslationEditor content={content} />;
};
