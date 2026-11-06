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
import type { PanelImperativeHandle as RRImperativePanelHandle } from 'react-resizable-panels';
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
import { cn, useIsMobile } from '@eightyfourthousand/lib-utils';

export enum MinPanelSizes {
  COLLAPSED = 0,
  SIDE_DEFAULT = 20,
  MAIN_DEFAULT = 60,
  SIDE_MIN = 10,
  MAIN_MIN = 30,
  FULL = 100,
}

export type ImperativePanelHandle = RRImperativePanelHandle;

// react-resizable-panels v4 treats numeric sizes as pixels and string sizes
// as percentages. MinPanelSizes are percentages, so render them as strings.
const pct = (size: MinPanelSizes) => `${size}%`;

export const LeftPanel = ({ children }: { children: ReactNode }) => {
  return <div className="size-full">{children}</div>;
};

export const MainPanel = ({ children }: { children: ReactNode }) => {
  return (
    <div data-panel="main" className="flex justify-center w-full">
      {children}
    </div>
  );
};

export const RightPanel = ({ children }: { children: ReactNode }) => {
  return <div className="size-full">{children}</div>;
};

export const MainPanelHeader = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="sticky top-16 flex justify-end z-10 pointer-events-none">
      {children}
    </div>
  );
};

export const ThreeColumns = ({
  children,
  className,
  leftPanelOpen,
  rightPanelOpen,
  leftPanelEnabled = true,
  rightPanelEnabled = true,
  mainPanelActions,
  onLeftPanelOpenChange,
  onRightPanelOpenChange,
}: {
  children: ReactNode;
  className?: string;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  leftPanelEnabled?: boolean;
  rightPanelEnabled?: boolean;
  mainPanelActions?: ReactNode;
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
        leftPanelRef.current?.resize(pct(MinPanelSizes.SIDE_DEFAULT));
      } else {
        leftPanelRef.current?.collapse();
      }
    }
  }, [leftPanelOpen, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      if (rightPanelOpen) {
        rightPanelRef.current?.resize(pct(MinPanelSizes.SIDE_DEFAULT));
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
    if (!leftPanelEnabled) {
      return;
    }
    onLeftPanelOpenChange?.(!leftPanelOpen);
  };

  const toggleRightPanel = () => {
    if (!rightPanelEnabled) {
      return;
    }
    onRightPanelOpenChange?.(!rightPanelOpen);
  };

  const toggleButtonClassName =
    'cursor-pointer text-accent/60 hover:text-accent [&_svg]:size-5 [&_svg]:stroke-1 transition-all';

  // One tree at every width, so the main panel mounts once and the server HTML
  // is the same for every device. Only the side panels respond to the
  // breakpoint: below md they are hidden and their content opens in a sheet.
  return (
    <div className="overflow-hidden size-full">
      <ResizablePanelGroup
        className={cn(
          // A panel left open on desktop must not take width on mobile. Keep
          // it in the layout at zero width rather than hiding it: the library
          // orders panels by their offsets, so a hidden panel is misplaced.
          // `!` because the library sets the flex and touch styles inline.
          'max-md:[&>[data-side-panel]]:basis-0! max-md:[&>[data-side-panel]]:grow-0! max-md:[&>[data-side-panel]]:overflow-hidden',
          // Allow pinch zoom on mobile, as the page does.
          'max-md:touch-auto!',
          className,
        )}
        orientation="horizontal"
        // Nothing resizes below md. Toggling this also makes the library
        // re-read the handles' positions once they are shown again.
        disabled={isMobile}
      >
        {leftPanelEnabled && (
          <>
            <ResizablePanel
              data-side-panel="left"
              panelRef={leftPanelRef}
              className={cn(
                'hidden md:block rounded border border-border/60 bg-background',
                !leftPanelOpen && 'border-none',
              )}
              collapsible
              collapsedSize={pct(MinPanelSizes.COLLAPSED)}
              defaultSize={
                leftPanelOpen
                  ? pct(MinPanelSizes.SIDE_DEFAULT)
                  : pct(MinPanelSizes.COLLAPSED)
              }
              minSize={pct(MinPanelSizes.SIDE_MIN)}
            >
              {!isMobile && leftPanelChildren}
            </ResizablePanel>
            <ResizableHandle
              withHandle={leftPanelOpen}
              className={cn(
                'hidden md:flex text-muted-foreground transparent',
                leftPanelOpen && 'w-2',
              )}
            />
          </>
        )}
        <ResizablePanel
          className="flex flex-col rounded border bg-background max-md:touch-auto!"
          style={{ overflow: 'auto', overscrollBehaviorY: 'none' }}
          defaultSize={pct(MinPanelSizes.FULL)}
          minSize={pct(MinPanelSizes.MAIN_MIN)}
        >
          <div className="bg-background rounded-t-lg sticky top-0 py-1.5 w-full flex justify-between z-10">
            <Button
              variant="link"
              size="icon"
              className={toggleButtonClassName}
              onClick={toggleLeftPanel}
            >
              <PanelLeftIcon />
              <span className="sr-only">Toggle Left Panel</span>
            </Button>
            <div className="flex items-center gap-1 md:gap-2">
              {mainPanelActions}
              {rightPanelEnabled && (
                <Button
                  variant="link"
                  size="icon"
                  className={toggleButtonClassName}
                  onClick={toggleRightPanel}
                >
                  <PanelRightIcon />
                  <span className="sr-only">Toggle Right Panel</span>
                </Button>
              )}
            </div>
          </div>
          <div className="bg-surface flex-1">
            {mainHeaderChildren}
            {mainPanelChildren}
          </div>
        </ResizablePanel>
        {rightPanelEnabled && (
          <>
            <ResizableHandle
              withHandle={rightPanelOpen}
              className={cn(
                'hidden md:flex text-muted-foreground',
                rightPanelOpen && 'w-2',
              )}
            />
            <ResizablePanel
              data-side-panel="right"
              panelRef={rightPanelRef}
              className={cn(
                'hidden md:block rounded border border-border/60 bg-background',
                !rightPanelOpen && 'border-none',
              )}
              collapsible
              collapsedSize={pct(MinPanelSizes.COLLAPSED)}
              defaultSize={
                rightPanelOpen
                  ? pct(MinPanelSizes.SIDE_DEFAULT)
                  : pct(MinPanelSizes.COLLAPSED)
              }
              minSize={pct(MinPanelSizes.SIDE_MIN)}
            >
              {!isMobile && rightPanelChildren}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {/* Sheets mount their content only while open, and open only on a tap,
          so they never change the server HTML. */}
      {leftPanelEnabled && (
        <Sheet
          open={!!leftPanelOpen && isMobile}
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
            {isMobile && leftPanelChildren}
          </SheetContent>
        </Sheet>
      )}
      {rightPanelEnabled && (
        <Sheet
          open={!!rightPanelOpen && isMobile}
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
            {isMobile && rightPanelChildren}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
