'use client';

import { Imprint } from '@eightyfourthousand/data-access';
import { Skeleton } from '@eightyfourthousand/design-system';
import { TitleDetails } from './TitleDetails';
import { TitlesCard } from './TitlesCard';

export const LongTitles = ({ imprint }: { imprint?: Imprint }) => {
  if (!imprint) {
    return <Skeleton className="h-48 w-full" />;
  }

  const { mainTitles } = imprint;
  const mainEnTitle = mainTitles?.en || '';

  return (
    <div className="mx-auto flex w-full flex-col gap-1 px-4 pt-8">
      <TitlesCard
        header={imprint.section}
        main={mainEnTitle}
        footer={imprint.toh}
        canEdit={false}
      />
      <div className="h-8" />
      <TitleDetails imprint={imprint} />
    </div>
  );
};
