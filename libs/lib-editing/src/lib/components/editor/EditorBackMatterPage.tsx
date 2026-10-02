'use client';

import {
  createGraphQLClient,
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

export const EditorBackMatterPage = () => {
  const withAttestations = isStaticFeatureEnabled('glossary-attestations');
  const { work } = useEditorState();
  const perPassageDocs = usePerPassageDocs();
  const [endnotes, setEndnotes] = useState<TranslationEditorContent>();
  const [abbreviations, setAbbreviations] =
    useState<TranslationEditorContent>();
  const [endnotesHasMore, setEndnotesHasMore] = useState<boolean>();
  const [abbreviationsHasMore, setAbbreviationsHasMore] = useState<boolean>();
  const [glossary, setGlossary] = useState<GlossaryTermsPage>();
  const [bibliography, setBibliography] = useState<BibliographyEntries>();

  useEffect(() => {
    (async () => {
      const { uuid } = work;
      const graphqlClient = createGraphQLClient();

      const [
        { blocks: endnoteBlocks, hasMoreAfter: endnoteHasMore },
        glossaryData,
        bibliographyData,
      ] = await Promise.all([
        getTranslationBlocks({
          client: graphqlClient,
          uuid,
          type: 'endnotes',
        }),
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

      setEndnotes(endnoteBlocks);
      setEndnotesHasMore(endnoteHasMore);
      setGlossary(glossaryData);
      setBibliography(bibliographyData);
    })();
  }, [work]);

  // The stack reads the abbreviations itself, so under the flag one passage is
  // asked for: the panel draws the tab only for a work that has any. The run
  // the stack seeds can't say so in time, as it is seeded after the body.
  useEffect(() => {
    if (!perPassageDocs.ready) return;
    let cancelled = false;
    (async () => {
      const { blocks, hasMoreAfter } = await getTranslationBlocks({
        client: createGraphQLClient(),
        uuid: work.uuid,
        type: 'abbreviations',
        ...(perPassageDocs.enabled ? { maxPassages: 1 } : {}),
      });
      if (cancelled) return;
      setAbbreviations(blocks);
      setAbbreviationsHasMore(hasMoreAfter);
    })();
    return () => {
      cancelled = true;
    };
  }, [work.uuid, perPassageDocs.ready, perPassageDocs.enabled]);

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

  if (!endnotes || !glossary || !bibliography || !abbreviations) {
    return <TranslationSkeleton />;
  }

  return (
    <BackMatterPanel
      workUuid={work.uuid}
      endnotes={endnotes}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={abbreviations}
      endnotesHasMore={endnotesHasMore}
      abbreviationsHasMore={abbreviationsHasMore}
      renderTranslation={renderTranslation}
      withAttestations={withAttestations}
      isEditor={true}
    />
  );
};
