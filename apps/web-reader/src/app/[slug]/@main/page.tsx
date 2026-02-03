import {
  createGraphQLClient,
  getTranslationUuids,
} from '@client-graphql';
import { ReaderBodyPage } from '@lib-editing/ssr';

export const revalidate = 60;
export const dynamicParams = true;

export const generateStaticParams = async () => {
  const client = createGraphQLClient();
  const uuids = await getTranslationUuids({ client });
  return uuids.map((slug) => ({ slug }));
};

const Page = ReaderBodyPage;

export default Page;
