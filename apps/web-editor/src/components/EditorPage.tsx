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
import { Passage, PassageDTO, passagesFromDTO } from '@data-access';
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

    (async () => {
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
    })();
  }, [slug, format]);

  const fetchEndNote = async (uuid: string): Promise<Passage> => {
    return {
      sort: 500,
      type: 'endnote',
      uuid,
      label: 'n.1',
      content:
        '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon dwelling in the wilderness even at the cost of their lives.',
      workUuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
      annotations: [],
    };
  };

  if (!content) {
    return <H3 className="text-muted-foreground px-12 py-2">Loading...</H3>;
  }

  switch (editorType) {
    case 'translation':
      return (
        <SandboxTranslationEditor
          content={content}
          fetchEndNote={fetchEndNote}
        />
      );

    default:
      return <BlockEditor content={content} />;
  }
};
