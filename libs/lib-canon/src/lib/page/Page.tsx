import {
  createBrowserClient,
  getCanonSection,
  getCanonWorks,
} from '@data-access';
import { ArticlePage } from './ArticlePage';
import { WorksPage } from './WorksPage';
import { ScrollArea } from '@design-system';

export const CanonPage = async ({
  searchParams,
  params,
}: {
  searchParams: Promise<Record<string, string>>;
  params: Promise<{ slug: string }>;
}) => {
  const { slug: uuid } = await params;

  const client = createBrowserClient();
  const section = await getCanonSection({ client, uuid });
  const works = await getCanonWorks({ client, uuid });
  const { tab } = await searchParams;

  if (!section) {
    return <div className="text-center">Section not found</div>;
  }

  const scrollAreaClass = `h-full ${tab === 'overview' ? 'bg-gray-50' : 'bg-background'}`;

  return (
    <ScrollArea className={scrollAreaClass}>
      <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
        <div className="w-5/6 max-w-[1080px]">
          {tab === 'overview' && <ArticlePage section={section} />}
          {tab === 'texts' && (
            <WorksPage label={section.label} works={works || []} />
          )}
        </div>
      </div>
    </ScrollArea>
  );
};
