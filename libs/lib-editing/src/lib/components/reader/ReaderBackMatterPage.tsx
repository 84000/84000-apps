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

  const { blocks: endnotes } = await getTranslationBlocks({
    client: graphqlClient,
    uuid: slug,
    type: 'endnotes',
  });

  const { blocks: abbreviations } = await getTranslationBlocks({
    client: graphqlClient,
    uuid: slug,
    type: 'abbreviations',
  });

  const withAttestations = isStaticFeatureEnabled('glossary-attestations');
  const glossary = await getWorkGlossary({
    client: graphqlClient,
    uuid: slug,
    withAttestations,
  });
  const bibliography = await getWorkBibliography({
    client: graphqlClient,
    uuid: slug,
  });

  return (
    <ReaderBackMatterPanel
      abbreviations={abbreviations}
      bibliography={bibliography}
      endnotes={endnotes}
      glossary={glossary}
    />
  );
};
