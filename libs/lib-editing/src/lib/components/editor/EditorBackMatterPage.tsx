'use client';

import {
  createBrowserClient,
  BACK_MATTER_FILTER,
  getTranslationPassages,
  getGlossaryInstances,
  getBibliographyEntries,
  GlossaryTermInstances,
  BibliographyEntries,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
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
      const client = createBrowserClient();
      const { passages } = await getTranslationPassages({
        client,
        uuid,
        type: BACK_MATTER_FILTER,
      });

      const endnotes = blocksFromTranslationBody(
        passages.filter((p) => p.type.startsWith('endnote')),
      );
      setEndnotes(endnotes);

      const abbreviations = blocksFromTranslationBody(
        passages.filter((p) => p.type.startsWith('abbreviation')),
      );
      setAbbreviations(abbreviations);

      const withAttestations = isStaticFeatureEnabled('glossary-attestations');
      const glossary = await getGlossaryInstances({
        client,
        uuid,
        withAttestations,
      });
      setGlossary(glossary);

      const bibliography = await getBibliographyEntries({ client, uuid });
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
