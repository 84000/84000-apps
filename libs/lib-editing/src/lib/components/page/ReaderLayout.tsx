'use client';

import { LeftPanel, MainPanel, RightPanel, ThreeColumns } from '@design-system';
import { ReactNode } from 'react';
import { ReaderCacheProvider } from '../reader/ReaderCache';

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
    <ReaderCacheProvider>
      <ThreeColumns>
        <LeftPanel>{left}</LeftPanel>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumns>
    </ReaderCacheProvider>
  );
};
