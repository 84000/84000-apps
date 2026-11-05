import {
  createBuildGraphQLClient,
  getPassageMetaPage,
  getWorkBibliography,
  getWorkGlossaryTerms,
} from '@eightyfourthousand/client-graphql/ssr';
import { isStaticFeatureEnabled } from '@eightyfourthousand/lib-instr/static';
import { isUuid } from '@eightyfourthousand/lib-utils';
import type { GraphQLClient } from 'graphql-request';
import { notFound } from 'next/navigation';
import { StackReaderBackMatterPanel } from './StackReaderBackMatterPanel';

/** Whether a work has any passages of a type, without reading them. */
const hasPassages = async (
  client: GraphQLClient,
  uuid: string,
  type: string,
) => {
  const { metas } = await getPassageMetaPage({ client, uuid, type, limit: 1 });
  return metas.length > 0;
};

/**
 * The reader's right panel with its notes and abbreviations drawn from the
 * stacks of the `StackReaderLayout` above it. `ReaderBackMatterPage`'s
 * counterpart: same route, same tabs.
 */
export const StackReaderBackMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = createBuildGraphQLClient();
  const withAttestations = isStaticFeatureEnabled('glossary-attestations');

  const [hasEndnotes, hasAbbreviations, glossary, bibliography] =
    await Promise.all([
      hasPassages(client, slug, 'endnotes'),
      hasPassages(client, slug, 'abbreviations'),
      getWorkGlossaryTerms({ client, uuid: slug, withAttestations }),
      getWorkBibliography({ client, uuid: slug }),
    ]);

  return (
    <StackReaderBackMatterPanel
      workUuid={slug}
      glossary={glossary}
      bibliography={bibliography}
      hasEndnotes={hasEndnotes}
      hasAbbreviations={hasAbbreviations}
      withAttestations={withAttestations}
    />
  );
};
