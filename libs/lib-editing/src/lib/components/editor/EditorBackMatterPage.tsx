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
import { TranslationRenderer } from '../shared/types';
import { useEditorState } from './EditorProvider';
import dynamic from 'next/dynamic';

import { useCallback, useEffect, useState } from 'react';
import type { TranslationEditorContent } from '../editor';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { isStaticFeatureEnabled } from '@eightyfourthousand/lib-instr/static';

/** See `EditorLayout` — the stack must not reach the server bundle. */
const StackTab = dynamic(
  () => import('../stack/StackTab').then((m) => m.StackTab),
  { ssr: false },
);

/** What a stacked tab is handed: the stack reads its own passages. */
const NO_CONTENT: TranslationEditorContent = [];

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

  // Read-only when the stack could not read the rows.
  const renderBibliography = useCallback(
    () => (
      <StackTab
        tab="bibliography"
        className="block"
        fallback={<BibliographyList content={bibliography ?? []} />}
      />
    ),
    [bibliography],
  );

  if (!glossary || !bibliography || !hasTabs) {
    return <TranslationSkeleton />;
  }

  return (
    <BackMatterPanel
      workUuid={work.uuid}
      endnotes={NO_CONTENT}
      glossary={glossary}
      bibliography={bibliography}
      abbreviations={NO_CONTENT}
      hasEndnotes={hasTabs.endnotes}
      hasAbbreviations={hasTabs.abbreviations}
      renderTranslation={renderTranslation}
      renderBibliography={renderBibliography}
      withAttestations={withAttestations}
      isEditor={true}
    />
  );
};
