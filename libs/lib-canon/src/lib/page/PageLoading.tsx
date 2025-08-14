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
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <div className="w-5/6 max-w-[1080px]">
        <div className="flex flex-col gap-8 py-8">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="w-full aspect-2/1" />
          <Skeleton className="h-12 w-full pt-32" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
};
