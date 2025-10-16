'use client';

import { ReactNode } from 'react';
import { NavigationProvider, ThreeColumnRenderer } from '../shared';

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
    <NavigationProvider>
      <ThreeColumnRenderer left={left} main={main} right={right} />
    </NavigationProvider>
  );
};
