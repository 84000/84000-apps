'use client';

import { ReactNode } from 'react';
import { EntityCacheProvider } from '../shared/EntityCache';
import { ThreeColumnRenderer } from '../shared/ThreeColumnRenderer';

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
      <ThreeColumnRenderer left={left} main={main} right={right} />
    </EntityCacheProvider>
  );
};
