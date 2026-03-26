'use client';

import { MiniLogo } from '@eightyfourthousand/design-system';
import { useNavigation } from './NavigationProvider';
import { cn } from '@eightyfourthousand/lib-utils';

export const TranslationHeader = ({ className }: { className?: string }) => {
  const { imprint } = useNavigation();

  return (
    <div
      className={cn(
        'h-11 w-full px-0 lg:px-3 flex justify-between text-lg bg-background',
        className,
      )}
    >
      <div className="flex gap-2 md:gap-5 min-w-0">
        <MiniLogo className="ms-3 me-1 my-auto" width={32} height={32} />
        <span className="font-serif font-light truncate text-darkgray text-xs sm:text-sm my-auto flex-shrink">
          {`${imprint?.mainTitles?.en ? `${imprint?.mainTitles?.en}` : ''}${imprint?.section ? ` from ${imprint?.section}` : ''}`}
        </span>
      </div>
    </div>
  );
};
