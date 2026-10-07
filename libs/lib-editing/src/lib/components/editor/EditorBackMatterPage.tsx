'use client';

import {
  createGraphQLClient,
  getPassageMetaPage,
  getTranslationBlocks,
  getWorkGlossaryTerms,
  getWorkBibliography,
  type GlossaryTermsPage,
} from '@eightyfourthousand/client-graphql';
import type { BibliographyEntries } from '@eightyfourthousand/data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { TranslationRenderer } from '../shared/types';
import { useEditorState } from './EditorProvider';
import { usePerPassageDocs } from './usePerPassageDocs';
import dynamic from 'next/dynamic';

import { useCallback, useEffect, useState } from 'react';
import { TranslationEditorContent } from '../editor';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { TranslationBuilder } from '../editor';
import { isStaticFeatureEnabled } from '@eightyfourthousand/lib-instr/static';

/** See `EditorLayout` — the stack must not reach the server bundle. */
const StackTab = dynamic(
  () => import('../stack/StackTab').then((m) => m.StackTab),
  { ssr: false },
);

/** The right panel's tabs drawn as stacks under the flag. */
const STACKED_TABS = new Set<string>(['endnotes', 'abbreviations']);

/** What a stacked tab is handed: the stack reads its own passages. */
const NO_CONTENT: TranslationEditorContent = [];

/** Whether a work has any passages of a type, without reading them. */
const hasPassages = async (uuid: string, type: string) => {
  const { metas } = await getPassageMetaPage({
    client: createGraphQLClient(),
    uuid,
    type,
    limit: 1,
  });
  return metas.length > 0;
};

export const EditorBackMatterPage = () => {
  const withAttestations = isStaticFeatureEnabled('glossary-attestations');
  const { work } = useEditorState();
  const perPassageDocs = usePerPassageDocs();
  // The stack reads these tabs itself, so the panel need not wait on them.
  const stacked = perPassageDocs.ready && perPassageDocs.enabled;
  const [endnotes, setEndnotes] = useState<TranslationEditorContent>();
  const [abbreviations, setAbbreviations] =
    useState<TranslationEditorContent>();
  const [endnotesHasMore, setEndnotesHasMore] = useState<boolean>();
  const [abbreviationsHasMore, setAbbreviationsHasMore] = useState<boolean>();
  const [hasTabs, setHasTabs] = useState<{
    endnotes: boolean;
    abbreviations: boolean;
  }>();
  const [glossary, setGlossary] = useState<GlossaryTermsPage>();
  const [bibliography, setBibliography] = useState<BibliographyEntries>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { uuid } = work;
      const graphqlClient = createGraphQLClient();
      const [glossaryData, bibliographyData] = await Promise.all([
        getWorkGlossaryTerms({
          client: graphqlClient,
          uuid,
          withAttestations,
        }),
        getWorkBibliography({
          client: graphqlClient,
          uuid,
        }),
      ]);
      if (cancelled) return;
      setGlossary(glossaryData);
      setBibliography(bibliographyData);
    })();
    return () => {
      cancelled = true;
    };
  }, [work, withAttestations]);

  // Read unless the stack is known to read them instead — at mount while the
  // flag is unresolved, so the paginated editor need not wait on it.
  useEffect(() => {
    if (stacked) return;
    let cancelled = false;
    (async () => {
      const graphqlClient = createGraphQLClient();
      const [endnotePage, abbreviationPage] = await Promise.all([
        getTranslationBlocks({
          client: graphqlClient,
          uuid: work.uuid,
          type: 'endnotes',
        }),
        getTranslationBlocks({
          client: graphqlClient,
          uuid: work.uuid,
          type: 'abbreviations',
        }),
      ]);
      if (cancelled) return;
      setEndnotes(endnotePage.blocks);
      setEndnotesHasMore(endnotePage.hasMoreAfter);
      setAbbreviations(abbreviationPage.blocks);
      setAbbreviationsHasMore(abbreviationPage.hasMoreAfter);
    })();
    return () => {
      cancelled = true;
    };
  }, [work.uuid, stacked]);

  // Under the stack the panel only needs to know which tabs to show.
  useEffect(() => {
    if (!stacked) return;
    let cancelled = false;
    (async () => {
      const [endnotes, abbreviations] = await Promise.all([
        hasPassages(work.uuid, 'endnotes'),
        hasPassages(work.uuid, 'abbreviations'),
      ]);
      if (cancelled) return;
      setHasTabs({ endnotes, abbreviations });
    })();
    return () => {
      cancelled = true;
    };
  }, [work.uuid, stacked]);

  const renderTranslation = useCallback(
    ({ content, name, className, hasMoreAfter }: TranslationRenderer) =>
      !perPassageDocs.ready ? (
        // Not "the flag is off" — the value has not arrived. Building the
        // paginated editor on that answer costs a TipTap instance and a Yjs
        // binding, thrown away when it does.
        <TranslationSkeleton />
      ) : perPassageDocs.enabled && STACKED_TABS.has(name) ? (
        <StackTab tab={name} className={className} />
      ) : (
        <TranslationBuilder
          content={content}
          name={name}
          className={className}
          filter={name}
          panel="right"
          hasMoreAfter={hasMoreAfter}
        />
      ),
    [perPassageDocs.enabled, perPassageDocs.ready],
  );

  const tabsKnown = stacked ? !!hasTabs : !!endnotes && !!abbreviations;
  if (!glossary || !bibliography || !tabsKnown) {
    return <TranslationSkeleton />;
  }

  return (
    <BackMatterPanel
      workUuid={work.uuid}
      endnotes={stacked ? NO_CONTENT : (endnotes ?? NO_CONTENT)}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={stacked ? NO_CONTENT : (abbreviations ?? NO_CONTENT)}
      endnotesHasMore={endnotesHasMore}
      abbreviationsHasMore={abbreviationsHasMore}
      hasEndnotes={stacked ? hasTabs?.endnotes : undefined}
      hasAbbreviations={stacked ? hasTabs?.abbreviations : undefined}
      renderTranslation={renderTranslation}
      withAttestations={withAttestations}
      isEditor={true}
    />
  );
};
