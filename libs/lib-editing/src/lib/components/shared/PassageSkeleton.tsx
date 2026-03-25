import { Skeleton } from '@eightyfourthousand/design-system';

export const PassageSkeleton = () => {
  return (
    <div className="flex gap-5 -ms-5 @c/sidebar:-ms-8">
      <Skeleton className="h-4 w-6" />
      <Skeleton className="h-32 grow" />
    </div>
  );
};
