import { ProjectStage } from '@data-access';
import { Badge } from '@design-system';

export const StageChip = ({ stage }: { stage: ProjectStage }) => {
  const className = `${stage.color} uppercase after:content-['.']`;
  return <Badge className={className}>{stage.label}</Badge>;
};
