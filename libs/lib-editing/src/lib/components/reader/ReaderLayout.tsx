'use client';

import { ReactNode, use } from 'react';
import { NavigationProvider, ThreeColumnRenderer } from '../shared';
import {
  LeftPanel,
  MainPanel,
  MainPanelHeader,
  RightPanel,
} from '@eightyfourthousand/design-system';
import { EditorHeader } from '../editor/EditorHeader';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';

export const ReaderLayout = ({
  withHeader = false,
  left,
  main,
  right,
  params,
  initialToh,
  initialHasTranslationContent,
}: {
  withHeader?: boolean;
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
  initialToh?: TohokuCatalogEntry;
  initialHasTranslationContent?: boolean;
}) => {
  const { slug } = use(params);
  return (
    <NavigationProvider
      uuid={slug}
      initialToh={initialToh}
      initialHasTranslationContent={initialHasTranslationContent}
    >
      <ThreeColumnRenderer withHeader={withHeader} withFocusToggle>
        <LeftPanel>{left}</LeftPanel>
        <MainPanelHeader>
          <div className="h-12" />
        </MainPanelHeader>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumnRenderer>
    </NavigationProvider>
  );
};
