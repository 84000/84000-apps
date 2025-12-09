'use client';

import { PanelLeftIcon, PanelRightIcon } from 'lucide-react';
import {
  Children,
  ReactElement,
  ReactNode,
  useRef,
  useEffect,
  useMemo,
} from 'react';
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

const BG_GRADIENT =
  "bg-surface 2xl:bg-[linear-gradient(to_bottom,#fffc,#ffffffd1_30rem,var(--surface)_40rem),url('/images/backgrounds/landscape-with-stupas-ochre.jpg')] bg-[linear-gradient(to_bottom,#fffc,#ffffffd1_30rem,var(--surface)_53rem),url('/images/backgrounds/landscape-with-stupas-ochre.jpg')] bg-no-repeat 2xl:bg-[position:center_-15rem] bg-[position:center_-30rem] 2xl:bg-[length:100%_60rem] bg-[length:auto_53rem]";

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
  return <div>{children}</div>;
};

export const MainPanel = ({ children }: { children: ReactNode }) => {
  return <div className="flex justify-center w-full">{children}</div>;
};

export const RightPanel = ({ children }: { children: ReactNode }) => {
  return <div>{children}</div>;
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
  const prevIsMobileRef = useRef(isMobile);

  const leftPanelChildren = useMemo(
    () =>
      Children.toArray(children).filter(
        (child) => (child as ReactElement)?.type === LeftPanel,
      ),
    [children],
  );

  const mainPanelChildren = useMemo(
    () =>
      Children.toArray(children).filter(
        (child) => (child as ReactElement)?.type === MainPanel,
      ),
    [children],
  );

  const rightPanelChildren = useMemo(
    () =>
      Children.toArray(children).filter(
        (child) => (child as ReactElement)?.type === RightPanel,
      ),
    [children],
  );

  const mainHeaderChildren = useMemo(
    () =>
      Children.toArray(children).filter(
        (child) => (child as ReactElement)?.type === MainPanelHeader,
      ),
    [children],
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

  // Close panels when switching between mobile and desktop
  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      if (leftPanelOpen) {
        onLeftPanelOpenChange?.(false);
      }
      if (rightPanelOpen) {
        onRightPanelOpenChange?.(false);
      }
      prevIsMobileRef.current = isMobile;
    }
  }, [
    isMobile,
    leftPanelOpen,
    rightPanelOpen,
    onLeftPanelOpenChange,
    onRightPanelOpenChange,
  ]);

  const toggleLeftPanel = () => {
    onLeftPanelOpenChange?.(!leftPanelOpen);
  };

  const toggleRightPanel = () => {
    onRightPanelOpenChange?.(!rightPanelOpen);
  };

  return (
    <>
      {/* Mobile Layout */}
      <div
        className={cn(
          'flex size-full overflow-hidden md:hidden rounded border bg-background',
          className,
        )}
      >
        <div style={{ overflow: 'auto' }}>
          <div className="bg-background rounded-t-lg sticky top-0 py-1.5 w-full flex justify-between z-10">
            <Button
              variant="link"
              size="icon"
              className="text-accent/60 hover:text-accent [&_svg]:size-5 [&_svg]:stroke-1 transition-all"
              onClick={toggleLeftPanel}
            >
              <PanelLeftIcon />
              <span className="sr-only">Toggle Left Panel</span>
            </Button>
            <Button
              variant="link"
              size="icon"
              className="text-accent/60 hover:text-accent [&_svg]:size-5 [&_svg]:stroke-1 transition-all"
              onClick={toggleRightPanel}
            >
              <PanelRightIcon />
              <span className="sr-only">Toggle Right Panel</span>
            </Button>
          </div>
          <div className={BG_GRADIENT}>
            {mainHeaderChildren}
            {mainPanelChildren}
          </div>
        </div>
        <Sheet
          open={leftPanelOpen && isMobile}
          onOpenChange={onLeftPanelOpenChange}
        >
          <SheetContent
            side="left"
            className="md:hidden w-full sm:max-w-full bg-sidebar"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Left Panel</SheetTitle>
              <SheetDescription>Navigation and content panel</SheetDescription>
            </SheetHeader>
            {leftPanelChildren}
          </SheetContent>
        </Sheet>
        <Sheet
          open={rightPanelOpen && isMobile}
          onOpenChange={onRightPanelOpenChange}
        >
          <SheetContent
            side="right"
            className="md:hidden w-full sm:max-w-full bg-sidebar"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Right Panel</SheetTitle>
              <SheetDescription>Additional content panel</SheetDescription>
            </SheetHeader>
            {rightPanelChildren}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block overflow-hidden size-full">
        <ResizablePanelGroup className={className} direction="horizontal">
          <ResizablePanel
            ref={leftPanelRef}
            className={cn(
              'hidden md:block rounded border border-border/60 bg-background',
              !leftPanelOpen && 'border-none',
            )}
            collapsible
            collapsedSize={MinPanelSizes.COLLAPSED}
            defaultSize={MinPanelSizes.COLLAPSED}
            minSize={MinPanelSizes.SIDE_MIN}
          >
            {leftPanelChildren}
          </ResizablePanel>
          <ResizableHandle
            withHandle={leftPanelOpen}
            className={cn(
              'text-muted-foreground transparent',
              leftPanelOpen && 'w-2',
            )}
          />
          <ResizablePanel
            className="hidden md:block rounded border bg-background"
            style={{ overflow: 'auto', overscrollBehaviorY: 'none' }}
            defaultSize={MinPanelSizes.FULL}
            minSize={MinPanelSizes.MAIN_MIN}
          >
            <div className="bg-background rounded-t-lg sticky top-0 py-1.5 w-full flex justify-between z-10">
              <Button
                variant="link"
                size="icon"
                className="text-accent/60 hover:text-accent [&_svg]:size-5 [&_svg]:stroke-1 transition-all"
                onClick={toggleLeftPanel}
              >
                <PanelLeftIcon />
                <span className="sr-only">Toggle Left Panel</span>
              </Button>
              <Button
                variant="link"
                size="icon"
                className="text-accent/60 hover:text-accent [&_svg]:size-5 [&_svg]:stroke-1 transition-all"
                onClick={toggleRightPanel}
              >
                <PanelRightIcon />
                <span className="sr-only">Toggle Right Panel</span>
              </Button>
            </div>
            <div className={cn(BG_GRADIENT)}>
              {mainHeaderChildren}
              {mainPanelChildren}
            </div>
          </ResizablePanel>
          <ResizableHandle
            withHandle={rightPanelOpen}
            className={cn('text-muted-foreground', rightPanelOpen && 'w-2')}
          />
          <ResizablePanel
            ref={rightPanelRef}
            className={cn(
              'hidden md:block rounded border border-border/60 bg-background',
              !rightPanelOpen && 'border-none',
            )}
            collapsible
            collapsedSize={MinPanelSizes.COLLAPSED}
            defaultSize={MinPanelSizes.COLLAPSED}
            minSize={MinPanelSizes.SIDE_MIN}
          >
            {rightPanelChildren}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
};
