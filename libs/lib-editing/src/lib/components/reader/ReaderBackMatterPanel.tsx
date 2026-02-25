'use client';

import { useCallback } from 'react';
import { GlossaryTermInstances, BibliographyEntries } from '@data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { TranslationRenderer } from '../shared/types';
import { TranslationReader } from '.';
import { TranslationEditorContent } from '../editor';

export const ReaderBackMatterPanel = ({
  endnotes,
  glossary,
  bibliography,
  abbreviations,
}: {
  endnotes: TranslationEditorContent;
  glossary: GlossaryTermInstances;
  bibliography: BibliographyEntries;
  abbreviations: TranslationEditorContent;
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
      endnotes={endnotes}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={abbreviations}
      renderTranslation={renderTranslation}
    />
  );
};
