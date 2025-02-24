import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@lib-utils';

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('pt-2', className)} {...props} />
));

CardContent.displayName = 'CardContent';
