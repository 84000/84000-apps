import {
  createBrowserClient,
  BACK_MATTER_FILTER,
  getTranslationPassages,
  getGlossaryInstances,
  getBibliographyEntries,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { ReaderBackMatterPanel } from './ReaderBackMatterPanel';
import { isUuid } from '@lib-utils';
import { notFound } from 'next/navigation';

export const ReaderBackMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = createBrowserClient();
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: BACK_MATTER_FILTER,
  });

  const endnotes = blocksFromTranslationBody(
    passages.filter((p) => p.type.startsWith('endnotes')),
  );
  const abbreviations = blocksFromTranslationBody(
    passages.filter((p) => p.type.startsWith('abbreviation')),
  );

  const glossary = await getGlossaryInstances({ client, uuid: slug });
  const bibliography = await getBibliographyEntries({ client, uuid: slug });

  return (
    <ReaderBackMatterPanel
      abbreviations={abbreviations}
      bibliography={bibliography}
      endnotes={endnotes}
      glossary={glossary}
    />
  );
};
