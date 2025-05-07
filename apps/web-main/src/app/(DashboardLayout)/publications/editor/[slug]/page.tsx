import { createBrowserClient, getTranslationUuids } from '@data-access';
import { EditorPage } from '../../../../../components/editor/EditorPage';

export const revalidate = 60;
export const dynamicParams = true;

const page = () => {
  return <EditorPage />;
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const slugs = await getTranslationUuids({ client });
  return slugs.map((slug) => ({ slug }));
};

export default page;
