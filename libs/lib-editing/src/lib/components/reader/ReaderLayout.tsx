'use client';

import { ReactNode, use } from 'react';
import { NavigationProvider, ThreeColumnRenderer } from '../shared';
import {
  LeftPanel,
  MainPanel,
  MainPanelHeader,
  RightPanel,
} from '@design-system';
import { EditorHeader } from '../editor/EditorHeader';

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
      <ThreeColumnRenderer>
        <LeftPanel>{left}</LeftPanel>
        <MainPanelHeader>
          <EditorHeader />
        </MainPanelHeader>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumnRenderer>
    </NavigationProvider>
  );
};
