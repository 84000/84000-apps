import { Format, Slug } from '@lib-editing/fixtures/types';
import { EditorPage } from '../../../components/EditorPage';

const Page = async ({
  params,
}: {
  params: Promise<{ slug: Slug; format: Format }>;
}) => {
  const { slug = 'basic', format = 'json' } = await params;
  return <EditorPage slug={slug} format={format} />;
};

export default Page;
