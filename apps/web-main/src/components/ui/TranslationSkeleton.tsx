import { Skeleton } from '@design-system';

export const TranslationSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 mb-4" />
      <Skeleton className="h-20 w-1/2" />
      <Skeleton className="h-48" />
      <Skeleton className="h-24 w-5/6" />
      <Skeleton className="h-64" />
    </div>
  );
};
