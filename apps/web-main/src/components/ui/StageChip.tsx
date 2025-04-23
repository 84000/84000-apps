import { ProjectStage } from '@data-access';
import { Badge } from '@design-system';

export const StageChip = ({ stage }: { stage: ProjectStage }) => {
  return <Badge className={stage.color}>{stage.label}</Badge>;
};
