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
import { usePerPassageDocs } from './usePerPassageDocs';
import dynamic from 'next/dynamic';

/** See `EditorLayout` — the stack must not reach the server bundle. */
const StackTab = dynamic(
  () => import('../stack/StackTab').then((m) => m.StackTab),
  { ssr: false },
);

const INITIAL_PASSAGES = 100;

/** The main panel's tabs drawn as stacks under the flag. */
const STACKED_TABS = new Set<string>(['front', 'translation']);

/** What the front tab is handed when the stack loads it instead. */
const NO_CONTENT: TranslationEditorContent = [];

export const EditorBodyPage = () => {
  const { work } = useEditorState();
  const perPassageDocs = usePerPassageDocs();
  // The stack reads front matter itself, so it need not wait for the page.
  const stackedFront = perPassageDocs.ready && perPassageDocs.enabled;
  const [body, setBody] = useState<TranslationEditorContent>();
  const [frontMatter, setFrontMatter] = useState<TranslationEditorContent>();
  const [frontMatterHasMore, setFrontMatterHasMore] = useState<boolean>();
  const [bodyHasMore, setBodyHasMore] = useState<boolean>();
  const [titles, setTitles] = useState<Title[]>();

  useEffect(() => {
    (async () => {
      const client = createGraphQLClient();

      // Front matter is read at mount whatever the flag says, as before: the
      // flag's value arrives later, and the paginated editor should not wait
      // on it. Under the flag the stack reads it, and this page goes unused.
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
        // Still read under the stack: its alignments decide the Compare tab.
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

  const renderTranslation = useCallback(
    ({ content, name, className, hasMoreAfter }: TranslationRenderer) =>
      !perPassageDocs.ready ? (
        // Not "the flag is off" — the value has not arrived. Building the
        // paginated editor on that answer costs a TipTap instance and a Yjs
        // binding, thrown away when it does.
        <TranslationSkeleton />
      ) : perPassageDocs.enabled && STACKED_TABS.has(name) ? (
        // Compare is drawn in the translation tab, so it shares that stack.
        <StackTab tab={name} className={className} />
      ) : (
        <TranslationBuilder
          content={content}
          name={name}
          className={className}
          filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
          panel="main"
          hasMoreAfter={hasMoreAfter}
        />
      ),
    [perPassageDocs.enabled, perPassageDocs.ready],
  );

  const front = stackedFront ? NO_CONTENT : frontMatter;
  if (!titles || !front || !body) {
    return <TranslationSkeleton />;
  }

  return (
    <BodyPanel
      titles={titles}
      frontMatter={front}
      body={body}
      frontMatterHasMore={frontMatterHasMore}
      bodyHasMore={bodyHasMore}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
    />
  );
};
