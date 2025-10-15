import {
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getTranslationPassages,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { ReaderFrontMatterPanel } from './ReaderFrontMatterPanel';

export const ReaderFrontMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: FRONT_MATTER_FILTER,
  });
  const summary = blocksFromTranslationBody(passages);

  return <ReaderFrontMatterPanel summary={summary} />;
};
