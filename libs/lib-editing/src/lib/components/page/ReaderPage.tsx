import {
  BodyItemType,
  createBrowserClient,
  getTranslationByUuid,
  Passages,
} from '@data-access';
import { Titles } from '@design-system';
import { notFound } from 'next/navigation';
import { ReaderProvider } from './ReaderProvider';
import { TranslationReader } from './reader/TranslationReader';
import { blocksFromTranslationBody } from '../../block';

const FRONT_MATTER: BodyItemType[] = ['acknowledgment', 'summary'];
const BACK_MATTER: BodyItemType[] = ['abbreviations', 'endnote'];

export const ReaderPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  console.log('Rendering ReaderPage for slug:', slug);

  const client = createBrowserClient();
  const publication = await getTranslationByUuid({ client, uuid: slug });

  if (!publication) {
    return notFound();
  }

  const { passages, titles } = publication;

  const mainTitles = titles.filter((t) => t.type === 'mainTitle');

  // body is everything not in front or back matter, sorted by `sort`
  const bodyKeys = Object.keys(passages).filter(
    (key) =>
      !FRONT_MATTER.includes(key as BodyItemType) &&
      !BACK_MATTER.includes(key as BodyItemType),
  );
  const bodyPassages: Passages = bodyKeys
    .map((key) => passages[key as BodyItemType] || [])
    .flat()
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  console.log('parsing passages');
  const summary = blocksFromTranslationBody(passages.summary || []);
  const body = blocksFromTranslationBody(bodyPassages);
  const endnotes = blocksFromTranslationBody(passages.endnote || []);

  // const frontMatter: Passages = FRONT_MATTER.map((type) => passages[type] || [])
  //   .flat()
  //   .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  //
  // const backMatter: Passages = BACK_MATTER.map((type) => passages[type] || [])
  //   .flat()
  //   .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  console.log('Rendering ReaderPage');

  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="xl:max-w-1/2 lg:max-w-2/3 sm:max-w-4/5 w-full">
        <div className="ms-12">
          <Titles titles={mainTitles} />
        </div>
        <ReaderProvider
          uuid={slug}
          work={publication.metadata}
          titles={publication.titles}
          summary={summary}
          body={body}
          endNotes={endnotes}
          glossary={publication.glossary || []}
          bibliography={publication.bibliography || []}
        >
          <TranslationReader />
        </ReaderProvider>
      </div>
    </div>
  );
};
