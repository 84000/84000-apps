import { createBrowserClient, getCanonSections } from '@data-access';
import { CanonPage } from '@lib-canon/ssr';

export const revalidate = 3600;

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const sections = await getCanonSections({ client });
  return sections.map((section) => ({
    slug: section.uuid,
  }));
};

const Page = CanonPage;

export default Page;
