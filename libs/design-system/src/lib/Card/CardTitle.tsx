import { cn } from '@lib-utils';
import { HTMLAttributes, forwardRef } from 'react';

export const CardTitle = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('card-title', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';
