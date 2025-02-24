import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@lib-utils';

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-2', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';
