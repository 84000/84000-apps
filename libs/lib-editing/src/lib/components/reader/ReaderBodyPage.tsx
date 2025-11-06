import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  getTranslationPassages,
  getTranslationTitles,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { ReaderBodyPanel } from './ReaderBodyPanel';
import { Suspense } from 'react';
import { TranslationSkeleton } from '../shared';

export const ReaderBodyPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: BODY_MATTER_FILTER,
  });
  const titles = await getTranslationTitles({ client, uuid: slug });
  const body = blocksFromTranslationBody(passages);

  return (
    <Suspense fallback={<TranslationSkeleton />}>
      <ReaderBodyPanel titles={titles} body={body} />
    </Suspense>
  );
};
