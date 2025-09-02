import { cn } from '@lib-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip/Tooltip';

export const TooltipCell = ({
  className,
  content,
}: {
  className?: string;
  content: string;
}) => {
  return (
    <div className={cn('w-full', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate">{content}</div>
        </TooltipTrigger>
        <TooltipContent className="max-w-100 text-wrap" align="start">
          {content}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
