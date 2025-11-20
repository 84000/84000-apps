import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  FRONT_MATTER_FILTER,
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

  const { passages: frontPassages } = await getTranslationPassages({
    client,
    uuid: slug,
    type: FRONT_MATTER_FILTER,
    maxPassages: INITIAL_PASSAGES,
    maxCharacters: INITIAL_MAX_CHARACTERS,
  });

  const { passages: bodyPassages } = await getTranslationPassages({
    client,
    uuid: slug,
    type: BODY_MATTER_FILTER,
    maxPassages: INITIAL_PASSAGES,
    maxCharacters: INITIAL_MAX_CHARACTERS,
  });

  const titles = await getTranslationTitles({ client, uuid: slug });
  const frontMatter = blocksFromTranslationBody(frontPassages);
  const body = blocksFromTranslationBody(bodyPassages);

  return (
    <ReaderBodyPanel titles={titles} frontMatter={frontMatter} body={body} />
  );
};
