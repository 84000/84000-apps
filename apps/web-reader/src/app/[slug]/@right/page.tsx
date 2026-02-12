import { ReaderBackMatterPage } from '@lib-editing/ssr';
import { getStaticUuids } from '../get-static-uuids';

export const dynamicParams = true;

export const generateStaticParams = async () => {
  const uuids = await getStaticUuids();
  return uuids.map((slug) => ({ slug }));
};

const Page = ReaderBackMatterPage;

export default Page;
