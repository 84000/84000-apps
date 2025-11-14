import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  getTranslationPassages,
  getTranslationTitles,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { ReaderBodyPanel } from './ReaderBodyPanel';
import { isUuid } from '@lib-utils';
import { notFound } from 'next/navigation';

const INITIAL_PASSAGES = 250;
const INITIAL_MAX_CHARACTERS = 80000;

export const ReaderBodyPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = createBrowserClient();
  const { passages } = await getTranslationPassages({
    client,
    uuid: slug,
    type: BODY_MATTER_FILTER,
    maxPassages: INITIAL_PASSAGES,
    maxCharacters: INITIAL_MAX_CHARACTERS,
  });
  const titles = await getTranslationTitles({ client, uuid: slug });
  const body = blocksFromTranslationBody(passages);

  return <ReaderBodyPanel titles={titles} body={body} />;
};
