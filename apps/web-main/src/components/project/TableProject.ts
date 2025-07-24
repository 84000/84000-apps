import { ProjectStage } from '@data-access';
import { DataTableRow } from '@design-system';

export type TableProject = DataTableRow & {
  uuid: string;
  toh: string;
  title: string;
  plainTitle: string;
  translator: string;
  stage: string;
  stageDate: string;
  stageObject: ProjectStage;
  pages: number;
  canons: string;
};
