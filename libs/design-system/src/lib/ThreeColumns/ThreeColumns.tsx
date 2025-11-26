'use client';

import { PanelLeftIcon, PanelRightIcon } from 'lucide-react';
import { Children, ReactElement, ReactNode, useRef, useEffect } from 'react';
import type { ImperativePanelHandle as RRImperativePanelHandle } from 'react-resizable-panels';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../Resizable/Resizable';
import { Button } from '../Button/Button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../Sheet/Sheet';
import { cn, useIsMobile } from '@lib-utils';

export enum MinPanelSizes {
  COLLAPSED = 0,
  SIDE_DEFAULT = 20,
  MAIN_DEFAULT = 60,
  SIDE_MIN = 10,
  MAIN_MIN = 30,
  FULL = 100,
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

export const MainPanelHeader = ({ children }: { children: ReactNode }) => {
  return (
    <div className="sticky top-16 w-full flex justify-end z-10">{children}</div>
  );
};

export const ThreeColumns = ({
  children,
  className,
  leftPanelOpen,
  rightPanelOpen,
  onLeftPanelOpenChange,
  onRightPanelOpenChange,
}: {
  children: ReactNode;
  className?: string;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  onLeftPanelOpenChange?: (open: boolean) => void;
  onRightPanelOpenChange?: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();
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

  const mainHeaderChildren = Children.toArray(children).filter(
    (child) => (child as ReactElement)?.type === MainPanelHeader,
  );

  // Sync panel state with refs on desktop
  useEffect(() => {
    if (!isMobile) {
      if (leftPanelOpen) {
        leftPanelRef.current?.expand(MinPanelSizes.SIDE_DEFAULT);
      } else {
        leftPanelRef.current?.collapse();
      }
    }
  }, [leftPanelOpen, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      if (rightPanelOpen) {
        rightPanelRef.current?.expand(MinPanelSizes.SIDE_DEFAULT);
      } else {
        rightPanelRef.current?.collapse();
      }
    }
  }, [rightPanelOpen, isMobile]);

  const toggleLeftPanel = () => {
    if (isMobile) {
      onLeftPanelOpenChange?.(!leftPanelOpen);
    } else {
      if (leftPanelRef.current?.isExpanded()) {
        leftPanelRef.current?.collapse();
        onLeftPanelOpenChange?.(false);
      } else {
        leftPanelRef.current?.expand();
        onLeftPanelOpenChange?.(true);
      }
    }
  };

  const toggleRightPanel = () => {
    if (isMobile) {
      onRightPanelOpenChange?.(!rightPanelOpen);
    } else {
      if (rightPanelRef.current?.isExpanded()) {
        rightPanelRef.current?.collapse();
        onRightPanelOpenChange?.(false);
      } else {
        rightPanelRef.current?.expand();
        onRightPanelOpenChange?.(true);
      }
    }
  };

  if (isMobile) {
    return (
      <div className={cn('flex size-full overflow-hidden', className)}>
        <div style={{ overflow: 'auto' }}>
          <div className="bg-muted sticky top-0 py-3 w-full flex justify-between z-10">
            <Button
              variant="link"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={toggleLeftPanel}
            >
              <PanelLeftIcon />
              <span className="sr-only">Toggle Left Panel</span>
            </Button>
            <Button
              variant="link"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={toggleRightPanel}
            >
              <PanelRightIcon className="size-4" />
              <span className="sr-only">Toggle Right Panel</span>
            </Button>
          </div>
          {mainHeaderChildren}
          {mainPanelChildren}
        </div>
        <Sheet open={leftPanelOpen} onOpenChange={onLeftPanelOpenChange}>
          <SheetContent side="left" className="w-full sm:max-w-full">
            <SheetHeader className="sr-only">
              <SheetTitle>Left Panel</SheetTitle>
              <SheetDescription>Navigation and content panel</SheetDescription>
            </SheetHeader>
            <div className="h-full overflow-auto">{leftPanelChildren}</div>
          </SheetContent>
        </Sheet>
        <Sheet open={rightPanelOpen} onOpenChange={onRightPanelOpenChange}>
          <SheetContent side="right" className="w-full sm:max-w-full">
            <SheetHeader className="sr-only">
              <SheetTitle>Right Panel</SheetTitle>
              <SheetDescription>Additional content panel</SheetDescription>
            </SheetHeader>
            <div className="h-full overflow-auto">{rightPanelChildren}</div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <ResizablePanelGroup className={className} direction="horizontal">
      <ResizablePanel
        ref={leftPanelRef}
        style={{ overflow: 'auto' }}
        className="bg-sidebar"
        collapsible
        collapsedSize={MinPanelSizes.COLLAPSED}
        defaultSize={MinPanelSizes.COLLAPSED}
        minSize={MinPanelSizes.SIDE_MIN}
      >
        {leftPanelChildren}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        style={{ overflow: 'auto' }}
        defaultSize={MinPanelSizes.FULL}
        minSize={MinPanelSizes.MAIN_MIN}
      >
        <div className="bg-muted sticky top-0 py-3 w-full flex justify-between z-10">
          <Button
            variant="link"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={toggleLeftPanel}
          >
            <PanelLeftIcon />
            <span className="sr-only">Toggle Left Panel</span>
          </Button>
          <Button
            variant="link"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={toggleRightPanel}
          >
            <PanelRightIcon />
            <span className="sr-only">Toggle Right Panel</span>
          </Button>
        </div>
        {mainHeaderChildren}
        {mainPanelChildren}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        ref={rightPanelRef}
        style={{ overflow: 'auto' }}
        className="bg-sidebar"
        collapsible
        collapsedSize={MinPanelSizes.COLLAPSED}
        defaultSize={MinPanelSizes.COLLAPSED}
        minSize={MinPanelSizes.SIDE_MIN}
      >
        {rightPanelChildren}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
