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
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="xl:max-w-1/2 lg:max-w-2/3 sm:max-w-4/5 w-full">
        <Titles titles={publication.frontMatter.titles} />
        {publication?.frontMatter.introductions.map(
          ({ type, content, uuid }) => {
            const Component = passageComponentForType[type];
            return <Component key={uuid}>{content}</Component>;
          },
        )}
        {publication?.body.map(({ type, content, uuid }) => {
          const Component = passageComponentForType[type];
          return <Component key={uuid}>{content}</Component>;
        })}
        <div className="h-[var(--header-height)]" />
      </div>
    </div>
  );
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

export default page;
