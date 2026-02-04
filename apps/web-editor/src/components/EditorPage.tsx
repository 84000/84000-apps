'use client';

import { H3 } from '@design-system';
import { useEffect, useState } from 'react';
import {
  BlockEditor,
  blocksFromTranslationBody,
  TranslationEditorContent,
} from '@lib-editing';
import { EditorType, Format, Slug } from '@lib-editing/fixtures/types';
import { EMPTY_DOCUMENT, SLUG_PATHS } from './constants';
import { PassageDTO, passagesFromDTO } from '@data-access';
import { SandboxTranslationEditor } from './SandboxTranslationEditor';

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

    const { type, content } = SLUG_PATHS[slug]?.[format] || {
      content: EMPTY_DOCUMENT,
      type: 'block',
    };

    let parsedContent = content;
    if (format === 'passages') {
      const dtos = content as PassageDTO[];
      const passages = passagesFromDTO(dtos);
      parsedContent = blocksFromTranslationBody(passages);
    }

    setContent(parsedContent);
    setEditorType(type);
  }, [slug, format]);

  if (!content) {
    return (
      <div className="w-full overflow-auto px-8 max-w-readable mx-auto">
        <H3 className="text-muted-foreground px-12 py-2">Loading...</H3>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto px-8 max-w-readable mx-auto">
      {editorType === 'translation' ? (
        <SandboxTranslationEditor content={content} />
      ) : (
        <BlockEditor content={content} />
      )}
    </div>
  );
};
