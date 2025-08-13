'use client';

import { Skeleton } from '@design-system';

export const PageLoading = () => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
};
