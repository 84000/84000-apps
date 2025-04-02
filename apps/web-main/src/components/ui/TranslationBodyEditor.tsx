'use client';

import { Translation } from '@data-access';
import { BlockEditor } from '@design-system';
import type { BlockEditorContent } from '@design-system';
import { bodyBlocksFromTranslation } from '@lib-editing';
import { useEffect, useState } from 'react';

export const TranslationBodyEditor = ({
  translation,
}: {
  translation: Translation;
}) => {
  const [content, setContent] = useState<BlockEditorContent>([]);

  useEffect(() => {
    const blocks = bodyBlocksFromTranslation(translation);
    setContent(blocks);
  }, [translation]);

  return <BlockEditor content={content} />;
};
