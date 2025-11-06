import { createBrowserClient, getTranslationUuids } from '@data-access';
import { ReaderFrontMatterPage, TranslationSkeleton } from '@lib-editing';
import { Suspense } from 'react';

export const revalidate = 60;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  return (
    <Suspense fallback={<TranslationSkeleton />}>
      <ReaderFrontMatterPage params={params} />
    </Suspense>
  );
};

export default Page;
