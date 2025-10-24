'use client';

import * as React from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';

import { cn } from '@lib-utils';

export const DEFAULT_HOVER_CARD_OPEN_DELAY = 100;
export const DEFAULT_HOVER_CARD_CLOSE_DELAY = 300;
export const DEFAULT_HOVER_CARD_SIDE_OFFSET = 4;
export const DEFAULT_HOVER_CARD_ALIGN = 'center';

function HoverCard({
  openDelay = DEFAULT_HOVER_CARD_OPEN_DELAY,
  closeDelay = DEFAULT_HOVER_CARD_CLOSE_DELAY,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return (
    <HoverCardPrimitive.Root
      data-slot="hover-card"
      openDelay={openDelay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

export const HOVER_CARD_CONTENT_STYLE =
  'bg-popover text-popover-foreground z-50 w-64 rounded-md border p-4 shadow-md outline-hidden';

export const HOVER_CARD_ANIMATIONS =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-hover-card-content-transform-origin)';

function HoverCardContent({
  className,
  align = DEFAULT_HOVER_CARD_ALIGN,
  sideOffset = DEFAULT_HOVER_CARD_SIDE_OFFSET,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          HOVER_CARD_CONTENT_STYLE,
          HOVER_CARD_ANIMATIONS,
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
