import {
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getTranslationPassages,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { FrontMatterPanel } from '../reader';

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

  return <FrontMatterPanel summary={summary} />;
};
