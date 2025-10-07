'use client';

import { useSearchParams } from 'next/navigation';
import { ArticlePage } from './ArticlePage';
import { WorksPage } from './WorksPage';
import { ScrollArea } from '@design-system';
import { CanonDetail, CanonWork } from '@data-access';

export const InnerPage = ({
  section,
  works,
}: {
  section: CanonDetail;
  works: CanonWork[];
}) => {
  const search = useSearchParams();
  const tab = search.get('tab') || 'overview';
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
