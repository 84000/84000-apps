import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip/Tooltip';

export const TooltipCell = ({
  className: classNamse,
  content,
}: {
  className: string;
  content: string;
}) => {
  return (
    <div className={classNamse}>
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
