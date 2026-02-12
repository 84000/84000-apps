import {
  createServerGraphQLClient,
  getTranslationBlocks,
  getWorkGlossary,
  getWorkBibliography,
} from '@client-graphql/ssr';
import { isStaticFeatureEnabled } from '@lib-instr/static';
import { ReaderBackMatterPanel } from './ReaderBackMatterPanel';
import { isUuid } from '@lib-utils';
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

  const graphqlClient = await createServerGraphQLClient();
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
    getWorkGlossary({
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
      abbreviations={abbreviations}
      bibliography={bibliography}
      endnotes={endnotes}
      glossary={glossary}
    />
  );
};
