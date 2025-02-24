import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@lib-utils';

export const CardDescription = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm text-gray-500 dark:text-gray-400 pt-2', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';
