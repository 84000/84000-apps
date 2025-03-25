import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Title,
} from '@design-system';
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <Title language={'en'}>
              {publication.frontMatter.titles.find((t) => t.language === 'en')
                ?.title || 'Untitled'}
            </Title>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TranslationBodyEditor translation={publication} />
        </CardContent>
      </Card>
    </>
  );
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const slugs = await getTranslationUuids({ client });
  return slugs.map((slug) => ({ slug }));
};

export default page;
