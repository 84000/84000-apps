import {
  createBuildGraphQLClient,
  getTranslationBlocks,
  getWorkGlossaryTerms,
  getWorkBibliography,
} from '@84000/client-graphql/ssr';
import { isStaticFeatureEnabled } from '@84000/lib-instr/static';
import { ReaderBackMatterPanel } from './ReaderBackMatterPanel';
import { isUuid } from '@84000/lib-utils';
import { notFound } from 'next/navigation';

export const ReaderBackMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const graphqlClient = createBuildGraphQLClient();
  const withAttestations = isStaticFeatureEnabled('glossary-attestations');

  const [
    { blocks: endnotes },
    { blocks: abbreviations },
    glossary,
    bibliography,
  ] = await Promise.all([
    getTranslationBlocks({
      client: graphqlClient,
      uuid: slug,
      type: 'endnotes',
    }),
    getTranslationBlocks({
      client: graphqlClient,
      uuid: slug,
      type: 'abbreviations',
    }),
    getWorkGlossaryTerms({
      client: graphqlClient,
      uuid: slug,
      withAttestations,
    }),
    getWorkBibliography({
      client: graphqlClient,
      uuid: slug,
    }),
  ]);

  return (
    <ReaderBackMatterPanel
      workUuid={slug}
      abbreviations={abbreviations}
      bibliography={bibliography}
      endnotes={endnotes}
      glossary={glossary}
    />
  );
};
