'use client';

import { Imprint } from '@data-access';
import { TitlesCard } from './TitlesCard';
import { Skeleton } from '../../Skeleton/Skeleton';
import { TitleDetails } from './TitleDetails';

export const LongTitles = ({ imprint }: { imprint?: Imprint }) => {
  if (!imprint) {
    return <Skeleton className="h-48 w-full" />;
  }

  const { mainTitles } = imprint;
  const mainEnTitle = mainTitles?.en || '';

  return (
    <div className="pt-8 px-4 mx-auto flex flex-col gap-1 w-full">
      <TitlesCard
        header={imprint.section}
        main={mainEnTitle}
        footer={imprint.toh}
        canEdit={false}
        hasMore={false}
      />
      <div className="h-8" />
      <TitleDetails imprint={imprint} />
    </div>
  );
};
