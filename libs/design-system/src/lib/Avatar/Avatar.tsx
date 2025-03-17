'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@lib-utils';
import Image from 'next/image';

export function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'relative flex size-10 shrink-0 overflow-hidden rounded-full',
        className,
      )}
      {...props}
    />
  );
}

export type AvatarImageProps = {
  className?: string;
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export function AvatarImage({
  className = '',
  src,
  alt = 'avatar',
  width = 32,
  height = 32,
}: AvatarImageProps) {
  if (!src) {
    return null;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn('aspect-1 size-full', className)}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}
