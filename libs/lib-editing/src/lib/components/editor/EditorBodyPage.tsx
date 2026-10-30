'use client';

import {
  createGraphQLClient,
  BODY_MATTER_FILTER,
  getTranslationBlocks,
  getTranslationTitles,
} from '@eightyfourthousand/client-graphql';
import type { Title } from '@eightyfourthousand/data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { TitlesRenderer, TranslationRenderer } from '../shared/types';
import { useEditorState } from './EditorProvider';
import { useCallback, useEffect, useState } from 'react';
import type { TranslationEditorContent } from '.';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { TitlesBuilder } from './TitlesBuilder';
import dynamic from 'next/dynamic';

/** See `EditorLayout` — the stack must not reach the server bundle. */
const StackTab = dynamic(
  () => import('../stack/StackTab').then((m) => m.StackTab),
  { ssr: false },
);

const INITIAL_PASSAGES = 100;

/** What the front tab is handed: the stack reads its own passages. */
const NO_CONTENT: TranslationEditorContent = [];

export const EditorBodyPage = () => {
  const { work } = useEditorState();
  const [body, setBody] = useState<TranslationEditorContent>();
  const [bodyHasMore, setBodyHasMore] = useState<boolean>();
  const [titles, setTitles] = useState<Title[]>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = createGraphQLClient();
      const [{ blocks, hasMoreAfter }, titlesData] = await Promise.all([
        // The stack reads the body itself; this read's alignments decide
        // whether the panel offers the Compare tab.
        getTranslationBlocks({
          client,
          uuid: work.uuid,
          type: BODY_MATTER_FILTER,
          maxPassages: INITIAL_PASSAGES,
        }),
        getTranslationTitles({ client, uuid: work.uuid }),
      ]);
      if (cancelled) return;
      setTitles(titlesData);
      setBody(blocks);
      setBodyHasMore(hasMoreAfter);
    })();
    return () => {
      cancelled = true;
    };
  }, [work.uuid]);

  const renderTitles = useCallback(
    ({ titles, imprint }: TitlesRenderer) => (
      <TitlesBuilder
        titles={titles}
        imprint={imprint}
        workUuid={work.uuid}
        // Titles save straight to the database, so the saved list is what is
        // stored — adopt it rather than refetching.
        onTitlesSaved={setTitles}
      />
    ),
    [work.uuid],
  );

  // Compare is drawn in the translation tab, so it shares that stack.
  const renderTranslation = useCallback(
    ({ name, className }: TranslationRenderer) => (
      <StackTab tab={name} className={className} />
    ),
    [],
  );

  if (!titles || !body) {
    return <TranslationSkeleton />;
  }

  return (
    <BodyPanel
      titles={titles}
      frontMatter={NO_CONTENT}
      body={body}
      bodyHasMore={bodyHasMore}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
    />
  );
};
