import {
  BODY_MATTER_FILTER,
  createServerGraphQLClient,
  FRONT_MATTER_FILTER,
  getTranslationBlocks,
  getTranslationTitles,
} from '@client-graphql/ssr';
import { ReaderBodyPanel } from './ReaderBodyPanel';
import { isUuid } from '@lib-utils';
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

  const client = await createServerGraphQLClient();

  const { blocks: frontMatter } = await getTranslationBlocks({
    client,
    uuid: slug,
    type: FRONT_MATTER_FILTER,
    maxPassages: INITIAL_PASSAGES,
  });

  const { blocks: body } = await getTranslationBlocks({
    client,
    uuid: slug,
    type: BODY_MATTER_FILTER,
    maxPassages: INITIAL_PASSAGES,
  });

  const titles = await getTranslationTitles({ client, uuid: slug });

  return (
    <ReaderBodyPanel titles={titles} frontMatter={frontMatter} body={body} />
  );
};
