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
  Separator,
  Titles,
  passageComponentForType,
} from '@design-system';
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
            <Titles titles={publication.frontMatter.titles} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {publication?.frontMatter.introductions.map(
            ({ type, content }, index) => {
              const Component = passageComponentForType[type];
              return <Component key={index}>{content}</Component>;
            },
          )}
          <Separator className="my-8" />
          {publication?.body.map(({ type, content }, index) => {
            const Component = passageComponentForType[type];
            return <Component key={index}>{content}</Component>;
          })}
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
