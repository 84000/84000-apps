'use client';

import { ReactNode, use } from 'react';
import { NavigationProvider, ThreeColumnRenderer } from '../shared';

export const ReaderLayout = ({
  left,
  main,
  right,
  params,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = use(params);
  return (
    <NavigationProvider uuid={slug}>
      <ThreeColumnRenderer left={left} main={main} right={right} />
    </NavigationProvider>
  );
};
