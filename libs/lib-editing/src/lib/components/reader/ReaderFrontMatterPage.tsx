import {
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getTranslationMetadataByUuid,
  getTranslationPassages,
  getTranslationToc,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { ReaderFrontMatterPanel } from './ReaderFrontMatterPanel';
import { TranslationSkeleton } from '../shared';
import { Suspense } from 'react';

export const ReaderFrontMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const work = await getTranslationMetadataByUuid({ client, uuid: slug });
  const toc = await getTranslationToc({ client, uuid: slug });
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: FRONT_MATTER_FILTER,
  });
  const summary = blocksFromTranslationBody(passages);

  return (
    <Suspense fallback={<TranslationSkeleton />}>
      <ReaderFrontMatterPanel summary={summary} toc={toc} work={work} />
    </Suspense>
  );
};
