'use client';

import { LeftPanel, MainPanel, RightPanel, ThreeColumns } from '@design-system';
import { ReactNode } from 'react';
import { EntityCacheProvider } from '../shared/EntityCache';

export const ReaderLayout = ({
  left,
  main,
  right,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
}) => {
  return (
    <EntityCacheProvider>
      <div className="absolute fixed top-0 w-full bg-[url(/images/backgrounds/bg-reader.webp)] h-150 bg-[length:100%_auto] -z-10" />
      <div className="absolute fixed top-0 w-full h-150 bg-gradient-to-b from-50% to-white -z-10" />
      <ThreeColumns>
        <LeftPanel>{left}</LeftPanel>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumns>
    </EntityCacheProvider>
  );
};
