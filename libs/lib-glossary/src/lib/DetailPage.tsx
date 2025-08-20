import { createBrowserClient, getGlossaryEntry } from '@data-access';
import { GlossaryEditor } from './GlossaryEditor';
import { GlossaryHeading } from './GlossaryHeading';
import { GlossaryInstancesTable } from './GlossaryInstancesTable';
import { GlossaryRelatedTerms } from './GlossaryRelatedTerms';
import { GlossaryVariants } from './GlossaryVariants';
import { notFound } from 'next/navigation';

export const DetailPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug: uuid } = await params;
  const client = createBrowserClient();
  const detail = await getGlossaryEntry({ client, uuid });

  if (!detail) {
    return notFound();
  }

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-8 w-full">
      <div className="w-full pb-8">
        <GlossaryHeading detail={detail} />
        <GlossaryEditor detail={detail} />
        <GlossaryVariants detail={detail} />
        <GlossaryInstancesTable detail={detail} />
        <GlossaryRelatedTerms detail={detail} />
      </div>
    </div>
  );
};
