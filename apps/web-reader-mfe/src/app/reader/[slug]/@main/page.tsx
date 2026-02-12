import { createBrowserClient, getTranslationUuids } from '@data-access';
import { ReaderBodyPage } from '@lib-editing/ssr';

export const revalidate = 60;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

const Page = ReaderBodyPage;

export default Page;
