import {
  createServerGraphQLClient,
  getTranslationMetadataByUuid,
  getTranslationToc,
} from '@client-graphql/ssr';
import { ReaderLeftPanel } from './ReaderLeftPanel';
import { isUuid } from '@lib-utils';
import { notFound } from 'next/navigation';

export const ReaderLeftPanelPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = await createServerGraphQLClient();
  const work = await getTranslationMetadataByUuid({ client, uuid: slug });

  if (!work) {
    return notFound();
  }

  const toc = await getTranslationToc({ client, uuid: slug });

  return <ReaderLeftPanel toc={toc} work={work} />;
};
