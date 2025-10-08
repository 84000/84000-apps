import { createBrowserClient, getTranslationUuids } from '@data-access';
import { ReaderFrontMatterPage } from '@lib-editing';

export const revalidate = 60;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

const Page = ReaderFrontMatterPage;

export default Page;
