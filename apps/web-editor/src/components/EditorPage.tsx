'use client';

import { H3 } from '@design-system';
import { useEffect, useState } from 'react';
import {
  BlockEditor,
  blocksFromTranslationBody,
  TranslationEditor,
  TranslationEditorContent,
} from '@lib-editing';
import { EditorType, Format, Slug } from '@lib-editing/fixtures/types';
import { EMPTY_DOCUMENT, SLUG_PATHS } from './constants';
import {
  GlossaryTermInstance,
  PassageDTO,
  translationBodyFromDTO,
} from '@data-access';

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

  const fetchEndNote = async (uuid: string) => {
    return [
      {
        type: 'passage',
        attrs: { label: 'n.1', uuid },
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `This is the content of endnote ${uuid}.`,
              },
            ],
          },
        ],
      },
    ];
  };

  const fetchGlossaryInstance = async (
    uuid: string,
  ): Promise<GlossaryTermInstance> => {
    return {
      uuid,
      authority: 'Sample Term',
      definition: `This is a sample definition for the glossary term with UUID ${uuid}.`,
      names: {
        english: 'Sample Term',
        chinese: '示例术语',
        sanskrit: 'udāharaṇa paccaya',
        tibetan: 'དམ་བཅོས་གྲུབ་པ།',
        wylie: 'dam bcos grub pa',
      },
    };
  };

  if (!content) {
    return <H3 className="text-muted-foreground px-12 py-2">Loading...</H3>;
  }

  switch (editorType) {
    case 'translation':
      return (
        <TranslationEditor
          content={content}
          fetchEndNote={fetchEndNote}
          fetchGlossaryInstance={fetchGlossaryInstance}
        />
      );

    default:
      return <BlockEditor content={content} />;
  }
};
