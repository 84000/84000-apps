'use client';

import {
  createGraphQLClient,
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  getTranslationBlocks,
  getTranslationTitles,
} from '@eightyfourthousand/client-graphql';
import type { Title } from '@eightyfourthousand/data-access';
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
  const [frontMatterHasMore, setFrontMatterHasMore] = useState<boolean>();
  const [bodyHasMore, setBodyHasMore] = useState<boolean>();
  const [titles, setTitles] = useState<Title[]>();

  useEffect(() => {
    (async () => {
      const client = createGraphQLClient();

      const [
        { blocks: frontBlocks, hasMoreAfter: frontHasMore },
        { blocks: bodyBlocks, hasMoreAfter: bodyHasMoreAfter },
        titlesData,
      ] = await Promise.all([
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
      setFrontMatterHasMore(frontHasMore);
      setBody(bodyBlocks);
      setBodyHasMore(bodyHasMoreAfter);
    })();
  }, [work.uuid]);

  const renderTitles = useCallback(
    ({ titles, imprint }: TitlesRenderer) => (
      <TitlesBuilder titles={titles} imprint={imprint} />
    ),
    [],
  );

  const renderTranslation = useCallback(
    ({ content, name, className, hasMoreAfter }: TranslationRenderer) => (
      <TranslationBuilder
        content={content}
        name={name}
        className={className}
        filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
        panel="main"
        hasMoreAfter={hasMoreAfter}
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
      frontMatterHasMore={frontMatterHasMore}
      bodyHasMore={bodyHasMore}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
    />
  );
};
