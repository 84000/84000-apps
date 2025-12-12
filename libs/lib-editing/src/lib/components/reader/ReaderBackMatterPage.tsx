import {
  createBrowserClient,
  getTranslationPassages,
  getGlossaryInstances,
  getBibliographyEntries,
} from '@data-access';
import { isStaticFeatureEnabled } from '@lib-instr/static';
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
  const { passages: endnotePassages } = await getTranslationPassages({
    client,
    uuid: slug,
    type: 'endnotes',
  });

  const endnotes = blocksFromTranslationBody(endnotePassages);

  const { passages: abbreviationPassages } = await getTranslationPassages({
    client,
    uuid: slug,
    type: 'abbreviations',
  });
  const abbreviations = blocksFromTranslationBody(abbreviationPassages);

  const withAttestations = isStaticFeatureEnabled('glossary-attestations');
  const glossary = await getGlossaryInstances({
    client,
    uuid: slug,
    withAttestations,
  });
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
