'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ToggleGroup, ToggleGroupItem } from '@design-system';

const TAB_OPTIONS = ['overview', 'texts'] as const;
type TabOption = (typeof TAB_OPTIONS)[number];

export const Header = () => {
  const searchParams = useSearchParams();
  let initialTab = searchParams.get('tab');
  if (!initialTab || !TAB_OPTIONS.includes(initialTab as TabOption)) {
    initialTab = 'overview';
  }

  const [value, setValue] = useState<TabOption>(initialTab as TabOption);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', value);
    router.push(`?${params.toString()}`);
  }, [value, router, searchParams]);

  return (
    <div className="flex items-center justify-between h-16 px-4 border-b-3 border-border">
      <h1 className="text-xl font-semibold text-navy">Canon Navigator</h1>
      <ToggleGroup
        variant="toggle"
        size="sm"
        type="single"
        value={value}
        onValueChange={(nextVal) => {
          nextVal && setValue(nextVal as TabOption);
        }}
        className="rounded-full bg-accent p-1 gap-1"
      >
        <ToggleGroupItem className="rounded-full px-4" value="overview">
          Overview
        </ToggleGroupItem>
        <ToggleGroupItem className="rounded-full" value="texts">
          Texts
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
