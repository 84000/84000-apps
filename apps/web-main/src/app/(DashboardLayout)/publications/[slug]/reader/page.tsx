import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import { Titles, passageComponentForType } from '@design-system';
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
      <Titles titles={publication.frontMatter.titles} />
      {publication?.frontMatter.introductions.map(
        ({ type, content }, index) => {
          const Component = passageComponentForType[type];
          return <Component key={index}>{content}</Component>;
        },
      )}
      {publication?.body.map(({ type, content }, index) => {
        const Component = passageComponentForType[type];
        return <Component key={index}>{content}</Component>;
      })}
    </>
  );
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

export default page;
