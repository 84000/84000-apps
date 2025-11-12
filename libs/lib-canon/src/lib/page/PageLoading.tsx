'use client';

import { Skeleton } from '@design-system';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const PageLoading = ({ redirectTo }: { redirectTo?: string }) => {
  const router = useRouter();

  useEffect(() => {
    if (redirectTo) {
      router.push(redirectTo);
    }
  }, [router, redirectTo]);

  return (
    <div className="w-full bg-gray-50">
      <div className="px-8 py-4 max-w-readable w-full mx-auto py-8">
        <div className="flex flex-col gap-6 py-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="w-full aspect-2/1" />
          <Skeleton className="h-12 w-full pt-32" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
};
