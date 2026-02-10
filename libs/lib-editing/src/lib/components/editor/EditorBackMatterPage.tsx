'use client';

import {
  createGraphQLClient,
  getTranslationBlocks,
  getWorkGlossary,
  getWorkBibliography,
} from '@client-graphql';
import type { GlossaryTermInstances, BibliographyEntries } from '@data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
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

      const { blocks: endnoteBlocks } = await getTranslationBlocks({
        client: graphqlClient,
        uuid,
        type: 'endnotes',
      });
      setEndnotes(endnoteBlocks);

      const { blocks: abbreviationBlocks } = await getTranslationBlocks({
        client: graphqlClient,
        uuid,
        type: 'abbreviations',
      });
      setAbbreviations(abbreviationBlocks);

      const withAttestations = isStaticFeatureEnabled('glossary-attestations');
      const glossary = await getWorkGlossary({
        client: graphqlClient,
        uuid,
        withAttestations,
      });
      setGlossary(glossary);

      const bibliography = await getWorkBibliography({
        client: graphqlClient,
        uuid,
      });
      setBibliography(bibliography);
    })();
  }, [work]);

  if (!endnotes || !glossary || !bibliography || !abbreviations) {
    return <TranslationSkeleton />;
  }

  return (
    <BackMatterPanel
      endnotes={endnotes}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={abbreviations}
      renderTranslation={({ content, name, className }) => (
        <TranslationBuilder
          content={content}
          name={name}
          className={className}
          filter={name}
          panel="right"
        />
      )}
    />
  );
};
