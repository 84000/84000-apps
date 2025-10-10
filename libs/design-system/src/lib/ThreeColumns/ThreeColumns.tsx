'use client';

import { PanelLeftIcon, PanelRightIcon } from 'lucide-react';
import { Children, ReactElement, ReactNode, useRef } from 'react';
import type { ImperativePanelHandle as RRImperativePanelHandle } from 'react-resizable-panels';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../Resizable/Resizable';
import { Button } from '../Button/Button';

enum MinPanelSizes {
  COLLAPSED = 0,
  SIDE_DEFAULT = 20,
  MAIN_DEFAULT = 60,
  SIDE_MIN = 10,
  MAIN_MIN = 30,
}

export type ImperativePanelHandle = RRImperativePanelHandle;

export const LeftPanel = ({ children }: { children: ReactNode }) => {
  return <div className="left-panel">{children}</div>;
};

export const MainPanel = ({ children }: { children: ReactNode }) => {
  return <div className="flex justify-center w-full">{children}</div>;
};

export const RightPanel = ({ children }: { children: ReactNode }) => {
  return <div className="right-panel">{children}</div>;
};

export const ThreeColumns = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);

  const leftPanelChildren = Children.toArray(children).filter(
    (child) => (child as ReactElement)?.type === LeftPanel,
  );

  const mainPanelChildren = Children.toArray(children).filter(
    (child) => (child as ReactElement)?.type === MainPanel,
  );

  const rightPanelChildren = Children.toArray(children).filter(
    (child) => (child as ReactElement)?.type === RightPanel,
  );

  const togglePanel = (panel?: ImperativePanelHandle | null) => {
    if (!panel) {
      return;
    }

    panel.isExpanded() ? panel.collapse() : panel.expand();
  };

  return (
    <ResizablePanelGroup className={className} direction="horizontal">
      <ResizablePanel
        ref={leftPanelRef}
        style={{ overflow: 'auto' }}
        className="bg-sidebar"
        collapsible
        collapsedSize={MinPanelSizes.COLLAPSED}
        defaultSize={MinPanelSizes.SIDE_DEFAULT}
        minSize={MinPanelSizes.SIDE_MIN}
      >
        {leftPanelChildren}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        style={{ overflow: 'auto' }}
        defaultSize={MinPanelSizes.MAIN_DEFAULT}
        minSize={MinPanelSizes.MAIN_MIN}
      >
        <div className="bg-muted sticky top-0 py-3 w-full flex justify-between z-10">
          <Button
            variant="link"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => togglePanel(leftPanelRef.current)}
          >
            <PanelLeftIcon />
          </Button>
          <Button
            variant="link"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => togglePanel(rightPanelRef.current)}
          >
            <PanelRightIcon />
          </Button>
        </div>
        {mainPanelChildren}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        ref={rightPanelRef}
        style={{ overflow: 'auto' }}
        className="bg-sidebar"
        collapsible
        collapsedSize={MinPanelSizes.COLLAPSED}
        defaultSize={MinPanelSizes.SIDE_DEFAULT}
        minSize={MinPanelSizes.SIDE_MIN}
      >
        {rightPanelChildren}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
