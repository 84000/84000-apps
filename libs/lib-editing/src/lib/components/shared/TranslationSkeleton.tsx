import { Skeleton, SkeletonGroup } from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';

export const TranslationSkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex h-full', className)}>
      <SkeletonGroup className="flex flex-col gap-6 pt-8">
        <Skeleton className="h-12 mb-4 animate-none" />
        <Skeleton className="h-20 w-1/2 animate-none" />
        <Skeleton className="h-48 animate-none" />
        <Skeleton className="h-24 w-5/6 animate-none" />
        <Skeleton className="h-64 animate-none" />
      </SkeletonGroup>
    </div>
  );
};
