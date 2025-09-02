import { cn } from '@lib-utils';

export function CardTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('text-xl font-semibold leading-none', className)}
      {...props}
    />
  );
}
