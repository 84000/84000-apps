import { Skeleton } from '@design-system';

/**
 * Skeleton that mimics the shape of a glossary entry:
 * a bold English name, 2-3 transliteration lines, and a short definition block.
 */
export const GlossarySkeleton = () => {
  return (
    <div className="flex gap-5">
      <Skeleton className="h-4 w-8 mt-1" />
      <div className="flex flex-col gap-1.5 grow">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full mt-1" />
      </div>
    </div>
  );
};
