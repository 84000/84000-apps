'use client';

import { useCallback } from 'react';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import type { BibliographyEntries } from '@eightyfourthousand/data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import type { TranslationRenderer } from '../shared/types';
import { StackTab } from '../stack/StackTab';

/**
 * The reader's right panel with its notes and abbreviations drawn as passage
 * stacks, under a `StackReaderLayout`.
 */
export const StackReaderBackMatterPanel = ({
  workUuid,
  glossary,
  bibliography,
  hasEndnotes,
  hasAbbreviations,
  withAttestations = false,
}: {
  workUuid: string;
  glossary: GlossaryTermsPage;
  bibliography: BibliographyEntries;
  /** Whether the work has notes; their stack reads them. */
  hasEndnotes: boolean;
  /** Whether the work has abbreviations; their stack reads them. */
  hasAbbreviations: boolean;
  withAttestations?: boolean;
}) => {
  const renderTranslation = useCallback(
    ({ name, className }: TranslationRenderer) => (
      <StackTab tab={name} className={className} />
    ),
    [],
  );

  return (
    <BackMatterPanel
      workUuid={workUuid}
      glossary={glossary}
      bibliography={bibliography}
      hasEndnotes={hasEndnotes}
      hasAbbreviations={hasAbbreviations}
      renderTranslation={renderTranslation}
      withAttestations={withAttestations}
    />
  );
};
