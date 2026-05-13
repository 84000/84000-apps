'use client';

import { useCallback } from 'react';
import { BibliographyEntries } from '@eightyfourthousand/data-access';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { TranslationRenderer } from '../shared/types';
import { TranslationReader } from '.';
import { TranslationEditorContent } from '../editor';

export const ReaderBackMatterPanel = ({
  workUuid,
  endnotes,
  glossary,
  bibliography,
  abbreviations,
  withAttestations = false,
}: {
  workUuid: string;
  endnotes: TranslationEditorContent;
  glossary: GlossaryTermsPage;
  bibliography: BibliographyEntries;
  abbreviations: TranslationEditorContent;
  withAttestations?: boolean;
}) => {
  const renderTranslation = useCallback(
    ({ content, name, className }: TranslationRenderer) => (
      <TranslationReader
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
      workUuid={workUuid}
      endnotes={endnotes}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={abbreviations}
      renderTranslation={renderTranslation}
      withAttestations={withAttestations}
    />
  );
};
