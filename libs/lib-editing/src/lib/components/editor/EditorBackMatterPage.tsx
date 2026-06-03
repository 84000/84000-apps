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
import { useCallback, useEffect, useState } from 'react';
import { TranslationEditorContent } from '../editor';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { TranslationBuilder } from '../editor';
import { isStaticFeatureEnabled } from '@eightyfourthousand/lib-instr/static';

export const EditorBackMatterPage = () => {
  const withAttestations = isStaticFeatureEnabled('glossary-attestations');
  const { work } = useEditorState();
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
        { blocks: abbreviationBlocks, hasMoreAfter: abbreviationHasMore },
        glossaryData,
        bibliographyData,
      ] = await Promise.all([
        getTranslationBlocks({
          client: graphqlClient,
          uuid,
          type: 'endnotes',
        }),
        getTranslationBlocks({
          client: graphqlClient,
          uuid,
          type: 'abbreviations',
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
      setAbbreviations(abbreviationBlocks);
      setAbbreviationsHasMore(abbreviationHasMore);
      setGlossary(glossaryData);
      setBibliography(bibliographyData);
    })();
  }, [work]);

  const renderTranslation = useCallback(
    ({ content, name, className, hasMoreAfter }: TranslationRenderer) => (
      <TranslationBuilder
        content={content}
        name={name}
        className={className}
        filter={name}
        panel="right"
        hasMoreAfter={hasMoreAfter}
      />
    ),
    [],
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
