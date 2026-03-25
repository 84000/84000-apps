import {
  createBuildGraphQLClient,
  getTranslationMetadataByUuid,
  getTranslationToc,
} from '@eightyfourthousand/client-graphql/ssr';
import { ReaderLeftPanel } from './ReaderLeftPanel';
import { isUuid } from '@eightyfourthousand/lib-utils';
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

  const client = createBuildGraphQLClient();
  const work = await getTranslationMetadataByUuid({ client, uuid: slug });

  if (!work) {
    return notFound();
  }

  const toc = await getTranslationToc({ client, uuid: slug });

  return <ReaderLeftPanel toc={toc} work={work} />;
};
