import { CheckCircleIcon, CircleIcon, TimerIcon } from 'lucide-react';
import { CanonWorkStatus } from '@data-access';
import { cn } from '@lib-utils';

export const WorkStatus = ({
  className,
  status,
}: {
  className?: string;
  status: CanonWorkStatus;
}) => {
  const iconForStatus = {
    published: <CheckCircleIcon className="size-4" />,
    'not-started': <CircleIcon className="size-4" />,
    'in-progress': <TimerIcon className="size-4" />,
  };

  return (
    <div className={cn('flex items-center gap-2 capitalize', className)}>
      {iconForStatus[status]}
      <span>{status.replace('-', ' ')}</span>
    </div>
  );
};
