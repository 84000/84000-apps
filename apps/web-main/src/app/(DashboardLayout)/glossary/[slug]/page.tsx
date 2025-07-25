import { createBrowserClient, getGlossaryEntry } from '@data-access';
import { GlossaryDetailPage } from '../../../../components/glossary/GlossaryDetailPage';
import { notFound } from 'next/navigation';

export const revalidate = 60;
export const dynamicParams = true;

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug: uuid } = await params;
  const client = createBrowserClient();
  const detail = await getGlossaryEntry({ client, uuid });

  if (!detail) {
    return notFound();
  }

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-8 w-full">
      <GlossaryDetailPage detail={detail} />
    </div>
  );
};

export default page;
