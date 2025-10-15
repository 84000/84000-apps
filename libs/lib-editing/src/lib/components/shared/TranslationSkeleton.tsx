import { Skeleton } from '@design-system';
import { cn } from '@lib-utils';

export const TranslationSkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex h-full', className)}>
      <div className="flex flex-col gap-6 pt-8">
        <Skeleton className="h-12 mb-4" />
        <Skeleton className="h-20 w-1/2" />
        <Skeleton className="h-48" />
        <Skeleton className="h-24 w-5/6" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
};
