'use client';

import * as React from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '@eightyfourthousand/lib-utils';
import { VerticalEllipsis } from '../VerticalEllipsis/VerticalEllipsis';

export function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  // Group manages its own display/flex-direction (cannot be overridden), so
  // orientation-based flex hacks are no longer needed.
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn('h-full w-full', className)}
      {...props}
    />
  );
}

export function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        'focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="flex h-full items-center justify-center">
          <VerticalEllipsis className="mt-16" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}
