'use client';

import { Translation } from '@data-access';
import { BlockEditor } from '@design-system';
import type { BlockEditorContent } from '@design-system';
import { useEffect, useState } from 'react';

export const TranslationBodyEditor = ({
  translation,
}: {
  translation: Translation;
}) => {
  const [content, setContent] = useState<BlockEditorContent>([]);

  useEffect(() => {
    const nodeTemplateForBlockType: {
      [key: string]: (text: string) => BlockEditorContent;
    } = {
      translation: (text: string) => ({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text,
          },
        ],
      }),
      translationHeader: (text: string) => ({
        type: 'heading',
        attrs: { level: 3 },
        content: [
          {
            type: 'text',
            text,
          },
        ],
      }),
    };

    const blocks: BlockEditorContent = [];
    translation.body.forEach((passage) => {
      if (!passage.content) {
        console.warn('passage has no content');
        console.warn(passage);
        return;
      }

      const block = nodeTemplateForBlockType[passage.type]?.(passage.content);

      if (!block) {
        console.warn('unknown block type');
        console.warn(passage);
        return;
      }

      blocks.push(block);
    });

    setContent(blocks);
  }, [translation.body]);

  return <BlockEditor content={content} />;
};
