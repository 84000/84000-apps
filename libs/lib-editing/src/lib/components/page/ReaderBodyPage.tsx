import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  getTranslationPassages,
  getTranslationTitles,
} from '@data-access';
import { BodyPanel } from '../reader';
import { blocksFromTranslationBody } from '../../block';

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

  return <BodyPanel titles={titles} body={body} />;
};
