import { ProjectStage } from '@data-access';

export type TableProject = {
  uuid: string;
  toh: string;
  title: string;
  plainTitle: string;
  translator: string;
  stage: string;
  stageDate: string;
  stageObject: ProjectStage;
  pages: number;
  cannons: string;
};
