import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@lib-utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'p-8 rounded-lg bg-white shadow-md dark:bg-gray-950',
        className
      )}
      {...props}
    />
  )
);

Card.displayName = 'Card';
