'use client';

import { ArticlePage } from './ArticlePage';
import { WorksPage } from './WorksPage';
import { ScrollArea } from '@design-system';
import { CanonDetail, CanonWork } from '@data-access';
import { useCanon } from '../context';

export const InnerPage = ({
  section,
  works,
}: {
  section: CanonDetail;
  works: CanonWork[];
}) => {
  const { tab } = useCanon();

  const scrollAreaClass = `h-full ${tab === 'overview' ? 'bg-gray-50' : 'bg-background'}`;

  return (
    <ScrollArea className={scrollAreaClass}>
      {tab === 'overview' && <ArticlePage section={section} />}
      {tab === 'texts' && (
        <WorksPage label={section.label} works={works || []} />
      )}
    </ScrollArea>
  );
};
