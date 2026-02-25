'use client';

import {
  createGraphQLClient,
  getTranslationBlocks,
  getWorkGlossary,
  getWorkBibliography,
} from '@client-graphql';
import type { GlossaryTermInstances, BibliographyEntries } from '@data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { TranslationRenderer } from '../shared/types';
import { useEditorState } from './EditorProvider';
import { useCallback, useEffect, useState } from 'react';
import { TranslationEditorContent } from '../editor';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { TranslationBuilder } from '../editor';
import { isStaticFeatureEnabled } from '@lib-instr/static';

export const EditorBackMatterPage = () => {
  const { work } = useEditorState();
  const [endnotes, setEndnotes] = useState<TranslationEditorContent>();
  const [abbreviations, setAbbreviations] =
    useState<TranslationEditorContent>();
  const [glossary, setGlossary] = useState<GlossaryTermInstances>();
  const [bibliography, setBibliography] = useState<BibliographyEntries>();

  useEffect(() => {
    (async () => {
      const { uuid } = work;
      const graphqlClient = createGraphQLClient();
      const withAttestations = isStaticFeatureEnabled('glossary-attestations');

      const [
        { blocks: endnoteBlocks },
        { blocks: abbreviationBlocks },
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
        getWorkGlossary({
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
      setAbbreviations(abbreviationBlocks);
      setGlossary(glossaryData);
      setBibliography(bibliographyData);
    })();
  }, [work]);

  if (!endnotes || !glossary || !bibliography || !abbreviations) {
    return <TranslationSkeleton />;
  }

  const renderTranslation = useCallback(
    ({ content, name, className }: TranslationRenderer) => (
      <TranslationBuilder
        content={content}
        name={name}
        className={className}
        filter={name}
        panel="right"
      />
    ),
    [],
  );

  return (
    <BackMatterPanel
      endnotes={endnotes}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={abbreviations}
      renderTranslation={renderTranslation}
    />
  );
};
