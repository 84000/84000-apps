import { Skeleton, SkeletonGroup } from '@eightyfourthousand/design-system';

export const PassageSkeleton = () => {
  return (
    <SkeletonGroup className="flex gap-5 -ms-5 @c/sidebar:-ms-8">
      <Skeleton className="h-4 w-6 animate-none" />
      <Skeleton className="h-32 grow animate-none" />
    </SkeletonGroup>
  );
};
