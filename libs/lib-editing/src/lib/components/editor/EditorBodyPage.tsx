'use client';

import {
  createGraphQLClient,
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  getTranslationBlocks,
  getTranslationTitles,
} from '@client-graphql';
import type { Title } from '@data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { TitlesRenderer, TranslationRenderer } from '../shared/types';
import { useEditorState } from './EditorProvider';
import { useCallback, useEffect, useState } from 'react';
import { TranslationBuilder, TranslationEditorContent } from '.';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { TitlesBuilder } from './TitlesBuilder';

const INITIAL_PASSAGES = 100;

export const EditorBodyPage = () => {
  const { work } = useEditorState();
  const [body, setBody] = useState<TranslationEditorContent>();
  const [frontMatter, setFrontMatter] = useState<TranslationEditorContent>();
  const [titles, setTitles] = useState<Title[]>();

  useEffect(() => {
    (async () => {
      const client = createGraphQLClient();

      const [{ blocks: frontBlocks }, { blocks: bodyBlocks }, titlesData] =
        await Promise.all([
          getTranslationBlocks({
            client,
            uuid: work.uuid,
            type: FRONT_MATTER_FILTER,
            maxPassages: INITIAL_PASSAGES,
          }),
          getTranslationBlocks({
            client,
            uuid: work.uuid,
            type: BODY_MATTER_FILTER,
            maxPassages: INITIAL_PASSAGES,
          }),
          getTranslationTitles({ client, uuid: work.uuid }),
        ]);

      setTitles(titlesData);
      setFrontMatter(frontBlocks);
      setBody(bodyBlocks);
    })();
  }, [work.uuid]);

  const renderTitles = useCallback(
    ({ titles, imprint }: TitlesRenderer) => (
      <TitlesBuilder titles={titles} imprint={imprint} />
    ),
    [],
  );

  const renderTranslation = useCallback(
    ({ content, name, className }: TranslationRenderer) => (
      <TranslationBuilder
        content={content}
        name={name}
        className={className}
        filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
        panel="main"
      />
    ),
    [],
  );

  if (!titles || !frontMatter || !body) {
    return <TranslationSkeleton />;
  }

  return (
    <BodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
    />
  );
};
