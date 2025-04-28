import { SemVer } from './semver';

export const PROJECT_STAGE_LABELS = [
  '1',
  '1.a',
  '2',
  '2.a',
  '2.b',
  '2.c',
  '2.d',
  '2.e',
  '2.f',
  '2.g',
  '2.h',
  '3',
  '4',
  '0',
];

export const STAGE_DESCRIPTIONS: Record<ProjectStageLabel, string> = {
  '1': 'Published and in app',
  '1.a': 'Published',
  '2': 'Marked up and awaiting final proofing',
  '2.a': 'Markup in progress',
  '2.b': 'Awaiting markup',
  '2.c': "Awaiting editor's OK form markup",
  '2.d': 'Copy editing complete',
  '2.e': 'Copy editing in progress',
  '2.f': 'Review complete',
  '2.g': 'In editorial review',
  '2.h': 'Awaiting editorial review',
  '3': 'In translation',
  '4': 'Application pending',
  '0': 'Not started',
};

export const STAGE_COLORS: Record<ProjectStageLabel, string> = {
  '1': 'emerald',
  '1.a': 'emerald',
  '2': 'ochre',
  '2.a': 'ochre',
  '2.b': 'ochre',
  '2.c': 'ochre',
  '2.d': 'ochre',
  '2.e': 'ochre',
  '2.f': 'ochre',
  '2.g': 'ochre',
  '2.h': 'ochre',
  '3': 'navy',
  '4': 'brick',
  '0': 'muted text-muted-foreground',
};

export type ProjectStageLabel = (typeof PROJECT_STAGE_LABELS)[number];

export type ProjectStage = {
  label: ProjectStageLabel;
  description: string;
  date: Date;
  color: string;
};

export type ProjectViewDTO = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: ProjectStageLabel;
  stage_date: string;
  pages: number;
};

export type ProjectTableDTO = {
  uuid: string;
  notes: string;
  contractDate: string;
  contractId: string;
  work: {
    uuid: string;
    pages: number;
    publicationDate: string;
    publicationStatus: ProjectStageLabel;
    publicationVersion: string;
    title: string;
    toh: string;
  };
};

export type Project = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: ProjectStage;
  pages: number;
  notes?: string;
  contractDate?: Date;
  contractId?: string;
  workUuid?: string;
  version?: SemVer;
};

export type ProjectStageDetailsDTO = {
  uuid: string;
  stage: ProjectStageLabel;
  stageDate: string;
  targetDate: string;
};

export type ProjectStageDetails = ProjectStageDetailsDTO;

export type ProjectAssetDTO = {
  uuid: string;
  projectUuid: string;
  stageUuid?: string;
  name: string;
  url: string;
  note?: string;
};

export type ProjectAsset = ProjectAssetDTO;

export type ProjectContributorType =
  | 'englishAdvisor'
  | 'englishAssociateEditor'
  | 'englishCopyEditor'
  | 'englishDharmaMaster'
  | 'englishFinalReviewer'
  | 'englishMarkup'
  | 'englishProjectEditor'
  | 'englishProjectManager'
  | 'englishProofReader'
  | 'englishReviser'
  | 'englishTranslator'
  | 'englishTranslationSponsor'
  | 'englishTranslationTeam'
  | 'tibetanTranslator';

export type ProjectContributorDTO = {
  uuid: string;
  projectUuid: string;
  stageUuid?: string;
  contributor: {
    uuid: string;
    name: string;
  };
  type: string;
  startDate: string;
  endDate: string;
};

export type ProjectContributor = {
  uuid: string;
  projectUuid: string;
  stageUuid?: string;
  name: string;
  type: ProjectContributorType;
  startDate: string;
  endDate: string;
};

export function projectFromViewDTO(dto: ProjectViewDTO): Project {
  return {
    uuid: dto.uuid,
    toh: dto.toh,
    title: dto.title,
    translator: dto.translator,
    stage: {
      label: dto.stage,
      description: STAGE_DESCRIPTIONS[dto.stage] || '',
      date: new Date(dto.stage_date),
      color: STAGE_COLORS[dto.stage] || 'grey',
    },
    pages: dto.pages,
  };
}
