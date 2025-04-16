import { createBrowserClient, getTranslationUuids } from '@data-access';
import { EditorPage } from '../../../../../components/ui/EditorPage';

export const revalidate = 60;
export const dynamicParams = true;

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;

  return <EditorPage uuid={slug} />;
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const slugs = await getTranslationUuids({ client });
  return slugs.map((slug) => ({ slug }));
};

export default page;
