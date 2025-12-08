'use client';

import { ToggleGroup, ToggleGroupItem } from '@design-system';
import { TabOption, useCanon } from '../context';

export const Header = () => {
  const { tab, setTab } = useCanon();

  return (
    <div className="h-16 py-1">
      <div className="flex items-center gap-4 bg-background rounded-full py-1 px-4 shadow-lg">
        <h1 className="text-xl font-semibold text-navy">Canon Navigator</h1>
        <div className="flex-1" />
        <div className="text-sm text-brick font-medium">Content Display:</div>
        <ToggleGroup
          variant="toggle"
          size="sm"
          type="single"
          value={tab}
          onValueChange={(nextVal) => {
            nextVal && setTab(nextVal as TabOption);
          }}
          className="rounded-full bg-background p-1 gap-1"
        >
          <ToggleGroupItem className="rounded-full px-4" value="overview">
            Overview
          </ToggleGroupItem>
          <ToggleGroupItem className="rounded-full" value="texts">
            Texts
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};
