import { cn } from '@lib-utils';

export const VerticalEllipsis = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center space-y-2',
        className,
      )}
    >
      <span className="block size-1 rounded-full bg-current" />
      <span className="block size-1 rounded-full bg-current" />
      <span className="block size-1 rounded-full bg-current" />
    </div>
  );
};
