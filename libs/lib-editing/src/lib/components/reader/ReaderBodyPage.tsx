import {
  BODY_MATTER_FILTER,
  createBuildGraphQLClient,
  FRONT_MATTER_FILTER,
  getTranslationBlocks,
  getTranslationMetadataByUuid,
  getTranslationTitles,
} from '@eightyfourthousand/client-graphql/ssr';
import { ReaderBodyPanel } from './ReaderBodyPanel';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound } from 'next/navigation';

const INITIAL_PASSAGES = 250;

export const ReaderBodyPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = createBuildGraphQLClient();

  const { blocks: frontMatter, hasMoreAfter: frontMatterHasMore } =
    await getTranslationBlocks({
      client,
      uuid: slug,
      type: FRONT_MATTER_FILTER,
      maxPassages: INITIAL_PASSAGES,
    });

  const { blocks: body, hasMoreAfter: bodyHasMore } = await getTranslationBlocks(
    {
      client,
      uuid: slug,
      type: BODY_MATTER_FILTER,
      maxPassages: INITIAL_PASSAGES,
    },
  );

  const titles = await getTranslationTitles({ client, uuid: slug });

  const work = await getTranslationMetadataByUuid({ client, uuid: slug });

  return (
    <ReaderBodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      frontMatterHasMore={frontMatterHasMore}
      bodyHasMore={bodyHasMore}
      publicationVersion={work?.publicationVersion}
    />
  );
};
