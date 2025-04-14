import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import { ThreeColumns, Title } from '@design-system';
import { TranslationBodyEditor } from '../../../../../components/ui/TranslationBodyEditor';
import { notFound } from 'next/navigation';

export const revalidate = 60;
export const dynamicParams = true;

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const client = createBrowserClient();
  const publication = await getTranslationByUuid({ client, uuid: slug });

  if (!publication) {
    return notFound();
  }

  return (
    <ThreeColumns>
      <Title language={'en'}>
        {publication.frontMatter.titles.find((t) => t.language === 'en')
          ?.title || 'Untitled'}
      </Title>
      <TranslationBodyEditor translation={publication} />
    </ThreeColumns>
  );
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const slugs = await getTranslationUuids({ client });
  return slugs.map((slug) => ({ slug }));
};

export default page;
