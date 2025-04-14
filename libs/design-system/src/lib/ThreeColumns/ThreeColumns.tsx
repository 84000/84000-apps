'use client';

import { PanelLeftIcon, PanelRightIcon } from 'lucide-react';
import { ReactNode, useRef } from 'react';
import { ImperativePanelHandle } from 'react-resizable-panels';
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

export const ThreeColumns = ({ children }: { children: ReactNode }) => {
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);

  const togglePanel = (panel?: ImperativePanelHandle | null) => {
    if (!panel) {
      return;
    }

    panel.isExpanded() ? panel.collapse() : panel.expand();
  };

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel
        ref={leftPanelRef}
        style={{ overflow: 'auto' }}
        collapsible
        collapsedSize={MinPanelSizes.COLLAPSED}
        defaultSize={MinPanelSizes.SIDE_DEFAULT}
        minSize={MinPanelSizes.SIDE_MIN}
      >
        <div className="text-center text-muted-foreground p-4">
          Coming Soon...
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        style={{ overflow: 'auto' }}
        defaultSize={MinPanelSizes.MAIN_DEFAULT}
        minSize={MinPanelSizes.MAIN_MIN}
      >
        <div className="sticky top-0 pt-2 w-full flex justify-between">
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
        <div className="flex justify-center w-full">
          <div className="xl:w-4/5 w-full px-8">{children}</div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        ref={rightPanelRef}
        style={{ overflow: 'auto' }}
        collapsible
        collapsedSize={MinPanelSizes.COLLAPSED}
        defaultSize={MinPanelSizes.SIDE_DEFAULT}
        minSize={MinPanelSizes.SIDE_MIN}
      >
        <div className="w-full text-center text-muted-foreground p-4">
          Coming Soon...
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
