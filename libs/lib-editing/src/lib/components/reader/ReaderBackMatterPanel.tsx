'use client';

import {
  GlossaryTermInstances,
  BibliographyEntries,
  BACK_MATTER_FILTER,
} from '@data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
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
  return (
    <BackMatterPanel
      endnotes={endnotes}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={abbreviations}
      renderTranslation={({ content, name, className }) => (
        <TranslationReader
          content={content}
          name={name}
          className={className}
          filter={BACK_MATTER_FILTER}
        />
      )}
    />
  );
};
