'use client';

import { ReactNode, use } from 'react';
import {
  NavigationProvider,
  ThreeColumnRenderer,
  useNavigation,
} from '../shared';
import { TohVisibilityStyle } from '../shared/hooks/useTohToggle';
import {
  LeftPanel,
  MainPanel,
  MainPanelHeader,
  RightPanel,
} from '@eightyfourthousand/design-system';
import { EditorHeader } from '../editor/EditorHeader';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';

/** Hides, from the first paint, what the server drew for other Tohs. */
const ActiveTohStyle = () => <TohVisibilityStyle toh={useNavigation().toh} />;

export const ReaderLayout = ({
  withHeader = false,
  left,
  main,
  right,
  params,
  initialToh,
  initialHasTranslationContent,
  withImprint,
}: {
  withHeader?: boolean;
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
  initialToh?: TohokuCatalogEntry;
  initialHasTranslationContent?: boolean;
  /** Whether the work's imprint is read; see `NavigationProvider`. */
  withImprint?: boolean;
}) => {
  const { slug } = use(params);
  return (
    <NavigationProvider
      uuid={slug}
      initialToh={initialToh}
      initialHasTranslationContent={initialHasTranslationContent}
      withImprint={withImprint}
    >
      <ActiveTohStyle />
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
