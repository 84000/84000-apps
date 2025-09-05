'use client';

import {
  BlockEditor,
  H3,
  TranslationEditor,
  TranslationEditorContent,
} from '@design-system';
import { useEffect, useState } from 'react';
import { blocksFromTranslationBody } from '@lib-editing';
import { EditorType, Format, Slug } from '@lib-editing/fixtures/types';
import { EMPTY_DOCUMENT, SLUG_PATHS } from './constants';
import { PassageDTO, translationBodyFromDTO } from '@data-access';

export const EditorPage = ({
  slug,
  format,
}: {
  slug?: Slug;
  format?: Format;
}) => {
  const [content, setContent] = useState<TranslationEditorContent>();
  const [editorType, setEditorType] = useState<EditorType>('block');

  useEffect(() => {
    if (!slug || !format) {
      setContent(EMPTY_DOCUMENT);
      setEditorType('block');
      return;
    }

    (async () => {
      const { type, content } = SLUG_PATHS[slug]?.[format] || {
        content: EMPTY_DOCUMENT,
        type: 'block',
      };

      let parsedContent = content;
      if (format === 'passages') {
        const dtos = content as PassageDTO[];
        const passages = translationBodyFromDTO(dtos);
        parsedContent = blocksFromTranslationBody(passages);
      }

      setContent(parsedContent);
      setEditorType(type);
    })();
  }, [slug, format]);

  if (!content) {
    return <H3 className="text-muted-foreground px-12 py-2">Loading...</H3>;
  }

  switch (editorType) {
    case 'translation':
      return <TranslationEditor content={content} />;
    default:
      return <BlockEditor content={content} />;
  }
};
