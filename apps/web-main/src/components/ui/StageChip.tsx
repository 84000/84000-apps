import { ProjectStage } from '@data-access';
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@design-system';

export const StageChip = ({ stage }: { stage: ProjectStage }) => {
  const triggerClassName = `bg-${stage.color} hover:bg-${stage.color}`;
  const badgeClassName = `${triggerClassName} shadow-md`;

  const stageLabel = (
    <span className='uppercase after:content-["."]'>{stage.label}</span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={triggerClassName}>{stageLabel}</Badge>
      </TooltipTrigger>
      <TooltipContent className="border-hidden shadow-none bg-transparent">
        <Badge className={badgeClassName}>
          {stageLabel}
          <span className="pl-1">{stage.description}</span>
        </Badge>
      </TooltipContent>
    </Tooltip>
  );
};
