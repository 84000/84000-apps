import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import { Title } from '@design-system';
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
    <div className="flex justify-center">
      <div className="lg:max-w-3/5 sm:max-w-4/5 w-full">
        <Title language={'en'}>
          {publication.frontMatter.titles.find((t) => t.language === 'en')
            ?.title || 'Untitled'}
        </Title>
        <TranslationBodyEditor translation={publication} />
      </div>
    </div>
  );
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const slugs = await getTranslationUuids({ client });
  return slugs.map((slug) => ({ slug }));
};

export default page;
