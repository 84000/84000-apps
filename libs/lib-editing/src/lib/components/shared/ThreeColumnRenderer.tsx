'use client';

import {
  ImperativePanelHandle,
  LeftPanel,
  MainPanel,
  RightPanel,
  ThreeColumns,
} from '@design-system';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useNavigation } from './NavigationProvider';

export const ThreeColumnRenderer = ({
  left,
  main,
  right,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
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
      leftPanelRef.current?.expand();
    } else {
      leftPanelRef.current?.collapse();
    }
  }, [panels.left.open]);

  useEffect(() => {
    if (panels.right.open) {
      rightPanelRef.current?.expand();
    } else {
      rightPanelRef.current?.collapse();
    }
  }, [panels.right.open]);

  return (
    <>
      <div className="absolute fixed top-0 w-full bg-[url(/images/backgrounds/bg-reader.webp)] h-150 bg-[length:100%_auto] -z-10" />
      <div className="absolute fixed top-0 w-full h-150 bg-gradient-to-b from-50% to-white -z-10" />
      <ThreeColumns
        leftPanel={leftPanelRef}
        rightPanel={rightPanelRef}
        onToggle={onToggle}
      >
        <LeftPanel>{left}</LeftPanel>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumns>
      ;
    </>
  );
};
