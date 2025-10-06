import { createBrowserClient, getTranslationUuids } from '@data-access';
import { ReaderPage } from '@lib-editing';

export const revalidate = 60;
export const dynamicParams = true;

const Page = ReaderPage;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

export default Page;
