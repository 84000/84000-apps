import {
  createServerGraphQLClient,
  getTranslationPassages,
  getWorkGlossary,
  getWorkBibliography,
} from '@client-graphql/ssr';
import { isStaticFeatureEnabled } from '@lib-instr/static';
import { blocksFromTranslationBody } from '../../block';
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

  const { passages: endnotePassages } = await getTranslationPassages({
    client: graphqlClient,
    uuid: slug,
    type: 'endnotes',
  });

  const endnotes = blocksFromTranslationBody(endnotePassages);

  const { passages: abbreviationPassages } = await getTranslationPassages({
    client: graphqlClient,
    uuid: slug,
    type: 'abbreviations',
  });
  const abbreviations = blocksFromTranslationBody(abbreviationPassages);

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
