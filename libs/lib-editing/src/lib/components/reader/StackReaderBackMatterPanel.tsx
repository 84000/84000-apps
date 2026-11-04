'use client';

import { useCallback } from 'react';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { BibliographyTitle } from '../shared/bibliography/BibliographyTitle';
import type { TranslationRenderer } from '../shared/types';
import { BIBLIOGRAPHY_TAB } from '../stack/stack-seed';
import { StackTab } from '../stack/StackTab';
import { useStackWork } from '../stack/stack-work-context';

/**
 * The reader's right panel with its notes, abbreviations and bibliography
 * drawn as passage stacks, under a `StackReaderLayout`.
 */
export const StackReaderBackMatterPanel = ({
  workUuid,
  glossary,
  hasEndnotes,
  hasAbbreviations,
  withAttestations = false,
}: {
  workUuid: string;
  glossary: GlossaryTermsPage;
  /** Whether the work has notes; their stack reads them. */
  hasEndnotes: boolean;
  /** Whether the work has abbreviations; their stack reads them. */
  hasAbbreviations: boolean;
  withAttestations?: boolean;
}) => {
  // The layout's seed holds the bibliography, so its stack is the tab.
  const hasBibliography = !!useStackWork()?.controllerFor(BIBLIOGRAPHY_TAB);

  const renderTranslation = useCallback(
    ({ name, className }: TranslationRenderer) => (
      <StackTab tab={name} className={className} />
    ),
    [],
  );

  // Its title is drawn, not a row, as the Glossary tab draws its own.
  const renderBibliography = useCallback(
    () => (
      <StackTab
        tab={BIBLIOGRAPHY_TAB}
        className="block mt-3"
        title={<BibliographyTitle className="mt-2" />}
      />
    ),
    [],
  );

  return (
    <BackMatterPanel
      workUuid={workUuid}
      glossary={glossary}
      hasEndnotes={hasEndnotes}
      hasAbbreviations={hasAbbreviations}
      hasBibliography={hasBibliography}
      renderTranslation={renderTranslation}
      renderBibliography={renderBibliography}
      withAttestations={withAttestations}
    />
  );
};
