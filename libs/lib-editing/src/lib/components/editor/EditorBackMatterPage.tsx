'use client';

import {
  createGraphQLClient,
  getPassageMetaPage,
  getWorkGlossaryTerms,
  getWorkBibliography,
  type GlossaryTermsPage,
} from '@eightyfourthousand/client-graphql';
import type { BibliographyEntries } from '@eightyfourthousand/data-access';
import { BackMatterPanel } from '../shared/BackMatterPanel';
import { BibliographyList } from '../shared/bibliography';
import { BibliographyTitle } from '../shared/bibliography/BibliographyTitle';
import {
  GlossaryPaginationProvider,
  GlossaryTermList,
} from '../shared/glossary';
import { GlossaryTitle } from '../shared/glossary/GlossaryTitle';
import { TranslationRenderer } from '../shared/types';
import { useEditorState } from './EditorProvider';
import dynamic from 'next/dynamic';

import { useCallback, useEffect, useState } from 'react';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { isStaticFeatureEnabled } from '@eightyfourthousand/lib-instr/static';

/** See `EditorLayout` — the stack must not reach the server bundle. */
const StackTab = dynamic(
  () => import('../stack/StackTab').then((m) => m.StackTab),
  { ssr: false },
);

/** Whether a work has any passages of a type, without reading them. */
const hasPassages = async (uuid: string, type: string) => {
  const { metas } = await getPassageMetaPage({
    client: createGraphQLClient(),
    uuid,
    type,
    limit: 1,
  });
  return metas.length > 0;
};

export const EditorBackMatterPage = () => {
  const withAttestations = isStaticFeatureEnabled('glossary-attestations');
  const { work } = useEditorState();
  const [hasTabs, setHasTabs] = useState<{
    endnotes: boolean;
    abbreviations: boolean;
  }>();
  const [glossary, setGlossary] = useState<GlossaryTermsPage>();
  const [bibliography, setBibliography] = useState<BibliographyEntries>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { uuid } = work;
      const graphqlClient = createGraphQLClient();
      const [glossaryData, bibliographyData] = await Promise.all([
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
      if (cancelled) return;
      setGlossary(glossaryData);
      setBibliography(bibliographyData);
    })();
    return () => {
      cancelled = true;
    };
  }, [work, withAttestations]);

  // The stack reads the endnotes and abbreviations itself; the panel only
  // needs to know which tabs to show.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [endnotes, abbreviations] = await Promise.all([
        hasPassages(work.uuid, 'endnotes'),
        hasPassages(work.uuid, 'abbreviations'),
      ]);
      if (cancelled) return;
      setHasTabs({ endnotes, abbreviations });
    })();
    return () => {
      cancelled = true;
    };
  }, [work.uuid]);

  const renderTranslation = useCallback(
    ({ name, className }: TranslationRenderer) => (
      <StackTab tab={name} className={className} />
    ),
    [],
  );

  // Read-only when the stack could not read the rows. The stack's title is
  // drawn, not stored, as the Glossary tab draws its own.
  const renderBibliography = useCallback(
    () => (
      <StackTab
        tab="bibliography"
        className="block mt-3"
        title={<BibliographyTitle className="mt-2" />}
        fallback={<BibliographyList content={bibliography ?? []} />}
      />
    ),
    [bibliography],
  );

  // The read-only list when the stack could not read the entries.
  const renderGlossary = useCallback(
    () => (
      <StackTab
        tab="glossary"
        className="block mt-3"
        title={<GlossaryTitle className="mt-2" />}
        fallback={
          glossary && (
            <GlossaryPaginationProvider
              workUuid={work.uuid}
              initialPage={glossary}
              withAttestations={withAttestations}
            >
              <GlossaryTermList isEditor />
            </GlossaryPaginationProvider>
          )
        }
      />
    ),
    [glossary, work.uuid, withAttestations],
  );

  if (!glossary || !bibliography || !hasTabs) {
    return <TranslationSkeleton />;
  }

  return (
    <BackMatterPanel
      workUuid={work.uuid}
      glossary={glossary}
      bibliography={bibliography}
      hasEndnotes={hasTabs.endnotes}
      hasAbbreviations={hasTabs.abbreviations}
      renderTranslation={renderTranslation}
      renderBibliography={renderBibliography}
      renderGlossary={renderGlossary}
      withAttestations={withAttestations}
      isEditor={true}
    />
  );
};
