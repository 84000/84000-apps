import { Skeleton } from '@eightyfourthousand/design-system';

/**
 * Streaming fallback for the reader route.
 *
 * Without one, a slot that is still resolving renders nothing at all, so a slow
 * load and a hung load look identical — a blank page. Skeletons make the
 * difference visible, which is the point: a reader that is working but slow
 * should not be mistaken for one that has stalled.
 *
 * Shaped like `PassageSkeleton` in lib-editing rather than importing it, since
 * that component is internal to the library and not part of its public surface.
 */
export default function ReaderLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 p-8">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex gap-5">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-32 grow" />
        </div>
      ))}
    </div>
  );
}
