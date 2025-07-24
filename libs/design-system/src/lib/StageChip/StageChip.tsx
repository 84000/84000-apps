import {
  ProjectStageLabel,
  STAGE_COLORS,
  STAGE_DESCRIPTIONS,
} from '@data-access';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/Tooltip';
import { Badge } from '../Badge/Badge';

export const StageChip = ({ stage }: { stage: ProjectStageLabel }) => {
  const color = STAGE_COLORS[stage];
  const triggerClassName = `bg-${color} hover:bg-${color}`;
  const badgeClassName = `${triggerClassName} shadow-md`;

  const stageLabel = (
    <span className='uppercase after:content-["."]'>{stage}</span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={triggerClassName}>{stageLabel}</Badge>
      </TooltipTrigger>
      <TooltipContent className="border-hidden shadow-none bg-transparent">
        <Badge className={badgeClassName}>
          {stageLabel}
          <span className="pl-1">{STAGE_DESCRIPTIONS[stage]}</span>
        </Badge>
      </TooltipContent>
    </Tooltip>
  );
};
