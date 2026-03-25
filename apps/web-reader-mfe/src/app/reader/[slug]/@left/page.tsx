import { createBrowserClient, getTranslationUuids } from '@eightyfourthousand/data-access';
import { ReaderLeftPanelPage } from '@eightyfourthousand/lib-editing/ssr';

export const revalidate = 60;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

const Page = ReaderLeftPanelPage;

export default Page;
