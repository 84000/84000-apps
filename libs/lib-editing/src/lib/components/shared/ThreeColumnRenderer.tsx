'use client';

import {
  ImperativePanelHandle,
  MinPanelSizes,
  ThreeColumns,
} from '@design-system';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useNavigation } from './NavigationProvider';
import { cn } from '@lib-utils';
import { TranslationHeader } from './TranslationHeader';

export const ThreeColumnRenderer = ({
  withHeader = false,
  children,
}: {
  withHeader?: boolean;
  children: ReactNode;
}) => {
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  const { panels, updatePanel } = useNavigation();

  const onToggle = useCallback(
    (panel?: ImperativePanelHandle | null) => {
      const name = panel === leftPanelRef.current ? 'left' : 'right';
      const currentPanel = panels[name];

      updatePanel({
        name,
        state: { open: !currentPanel.open, tab: currentPanel.tab },
      });
    },
    [updatePanel, panels],
  );

  useEffect(() => {
    if (panels.left.open) {
      leftPanelRef.current?.expand(MinPanelSizes.SIDE_DEFAULT);
    } else {
      leftPanelRef.current?.collapse();
    }
  }, [panels.left.open]);

  useEffect(() => {
    if (panels.right.open) {
      rightPanelRef.current?.expand(MinPanelSizes.SIDE_DEFAULT);
    } else {
      rightPanelRef.current?.collapse();
    }
  }, [panels.right.open]);

  return (
    <div
      className={cn('fixed flex flex-col size-full', withHeader ? 'pb-20' : '')}
    >
      <TranslationHeader />
      <ThreeColumns
        leftPanel={leftPanelRef}
        rightPanel={rightPanelRef}
        onToggle={onToggle}
      >
        {children}
      </ThreeColumns>
    </div>
  );
};
