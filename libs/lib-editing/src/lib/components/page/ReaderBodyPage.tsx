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
  const mainTitles = titles.filter((t) => t.type === 'mainTitle');
  const body = blocksFromTranslationBody(passages);

  return <BodyPanel titles={mainTitles} body={body} />;
};
