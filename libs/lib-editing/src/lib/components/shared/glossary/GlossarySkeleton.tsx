import { Skeleton, SkeletonGroup } from '@eightyfourthousand/design-system';

/**
 * Skeleton that mimics the shape of a glossary entry:
 * a bold English name, 2-3 transliteration lines, and a short definition block.
 */
export const GlossarySkeleton = () => {
  return (
    <SkeletonGroup className="flex gap-3 -ms-5">
      <Skeleton className="h-4 w-6 animate-none" />
      <div className="flex flex-col gap-1.5 grow">
        <Skeleton className="h-5 w-40 animate-none" />
        <Skeleton className="h-4 w-32 animate-none" />
        <Skeleton className="h-4 w-28 animate-none" />
        <Skeleton className="h-10 w-full mt-1 animate-none" />
      </div>
    </SkeletonGroup>
  );
};
