import { createBrowserClient, getTranslationUuids } from '@eightyfourthousand/data-access';
import { ReaderBodyPage } from '@eightyfourthousand/lib-editing/ssr';

export const revalidate = 60;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

const Page = ReaderBodyPage;

export default Page;
