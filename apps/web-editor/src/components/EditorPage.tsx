'use client';

import { useMemo } from 'react';
import {
  BlockEditor,
  blocksFromTranslationBody,
  TranslationEditorContent,
} from '@eightyfourthousand/lib-editing';
import { EditorType, Format, Slug } from '@eightyfourthousand/lib-editing/fixtures/types';
import { EMPTY_DOCUMENT, SLUG_PATHS } from './constants';
import { PassageDTO, passagesFromDTO } from '@eightyfourthousand/data-access';
import { SandboxTranslationEditor } from './SandboxTranslationEditor';

export const EditorPage = ({
  slug,
  format,
}: {
  slug?: Slug;
  format?: Format;
}) => {
  const { content, editorType } = useMemo((): {
    content: TranslationEditorContent;
    editorType: EditorType;
  } => {
    if (!slug || !format) {
      return { content: EMPTY_DOCUMENT, editorType: 'block' };
    }

    const { type, content } = SLUG_PATHS[slug]?.[format] || {
      content: EMPTY_DOCUMENT,
      type: 'block',
    };

    if (format === 'passages') {
      const dtos = content as PassageDTO[];
      const passages = passagesFromDTO(dtos);
      return { content: blocksFromTranslationBody(passages), editorType: type };
    }

    return { content, editorType: type };
  }, [slug, format]);

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
