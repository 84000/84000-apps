import {
  createBrowserClient,
  getTranslationMetadataByUuid,
  getTranslationToc,
} from '@data-access';
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

  const client = createBrowserClient();
  const work = await getTranslationMetadataByUuid({ client, uuid: slug });
  const toc = await getTranslationToc({ client, uuid: slug });

  return <ReaderLeftPanel toc={toc} work={work} />;
};
