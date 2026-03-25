import {
  ProjectStageLabel,
  STAGE_COLORS,
  STAGE_DESCRIPTIONS,
} from '@eightyfourthousand/data-access';
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@eightyfourthousand/design-system';

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
      <TooltipContent className="border-hidden bg-transparent shadow-none">
        <Badge className={badgeClassName}>
          {stageLabel}
          <span className="pl-1">{STAGE_DESCRIPTIONS[stage]}</span>
        </Badge>
      </TooltipContent>
    </Tooltip>
  );
};
