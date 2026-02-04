'use client';

import {
  createGraphQLClient,
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  getTranslationPassages,
  getTranslationTitles,
} from '@client-graphql';
import type { Title } from '@data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { blocksFromTranslationBody } from '../../block';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
import { TranslationBuilder, TranslationEditorContent } from '.';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { TitlesBuilder } from './TitlesBuilder';

const INITIAL_PASSAGES = 500;
const INITIAL_MAX_CHARACTERS = 200000;

export const EditorBodyPage = () => {
  const { work } = useEditorState();
  const [body, setBody] = useState<TranslationEditorContent>();
  const [frontMatter, setFrontMatter] = useState<TranslationEditorContent>();
  const [titles, setTitles] = useState<Title[]>();

  useEffect(() => {
    (async () => {
      const client = createGraphQLClient();
      const { passages: frontPassages } = await getTranslationPassages({
        client,
        uuid: work.uuid,
        type: FRONT_MATTER_FILTER,
        maxPassages: INITIAL_PASSAGES,
        maxCharacters: INITIAL_MAX_CHARACTERS,
      });

      const { passages: bodyPassages } = await getTranslationPassages({
        client,
        uuid: work.uuid,
        type: BODY_MATTER_FILTER,
        maxPassages: INITIAL_PASSAGES,
        maxCharacters: INITIAL_MAX_CHARACTERS,
      });

      const titles = await getTranslationTitles({ client, uuid: work.uuid });
      setTitles(titles);

      const frontMatter = blocksFromTranslationBody(frontPassages);
      setFrontMatter(frontMatter);

      const body = blocksFromTranslationBody(bodyPassages);
      setBody(body);
    })();
  }, [work.uuid]);

  if (!titles || !frontMatter || !body) {
    return <TranslationSkeleton />;
  }

  return (
    <BodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      renderTitles={({ titles, imprint }) => (
        <TitlesBuilder titles={titles} imprint={imprint} />
      )}
      renderTranslation={({ content, name, className }) => (
        <TranslationBuilder
          content={content}
          name={name}
          className={className}
          filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
          panel="main"
        />
      )}
    />
  );
};
