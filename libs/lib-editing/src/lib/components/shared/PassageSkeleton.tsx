import { Skeleton } from '@design-system';

export const PassageSkeleton = () => {
  return (
    <div className="flex gap-5">
      <Skeleton className="h-6 w-6" />
      <Skeleton className="h-32 grow" />
    </div>
  );
};
