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

export const CANON_TYPES = ['kangyur', 'tengyur'];

export type ProjectStageLabel = (typeof PROJECT_STAGE_LABELS)[number];

export type CanonType = (typeof CANON_TYPES)[number];

export type ProjectStage = {
  label: ProjectStageLabel;
  description: string;
  date: Date;
  targetDate?: Date;
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
  type?: string;
};

export type ProjectTableDTO = {
  uuid: string;
  notes: string;
  contractDate: string;
  contractId: string;
  workUuid: string;
  pages: number;
  publicationDate: string;
  version: string;
  stage: ProjectStageLabel;
  restriction: boolean;
  title: string;
  toh: string;
  mainTranslator: string;
  translationGroup: string;
};

export type Project = {
  uuid: string;
  toh: string;
  title: string;
  translator?: string;
  translationGroup?: string;
  stage: ProjectStage;
  pages: number;
  notes?: string;
  contractDate?: Date;
  contractId?: string;
  workUuid?: string;
  version?: SemVer;
  canons?: string;
};

export type ProjectStageDetailsDTO = {
  uuid: string;
  stage: ProjectStageLabel;
  stageDate: string;
  targetDate?: string;
};

export type ProjectStageDetail = {
  uuid: string;
  stage: ProjectStage;
  targetDate?: Date;
};

export type ProjectStageDetails = ProjectStageDetail[];

export type ProjectAssetDTO = {
  uuid: string;
  projectUuid: string;
  stageUuid?: string;
  filename: string;
  url: string;
  note?: string;
};

export type ProjectAsset = ProjectAssetDTO;

export function projectStageDetailFromDTO(
  dto: ProjectStageDetailsDTO,
): ProjectStageDetail {
  return {
    uuid: dto.uuid,
    stage: {
      label: dto.stage,
      description: STAGE_DESCRIPTIONS[dto.stage] || '',
      date: new Date(dto.stageDate),
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      color: STAGE_COLORS[dto.stage] || 'grey',
    },
  };
}

export function projectStageDetailsFromDTO(
  dto?: ProjectStageDetailsDTO[],
): ProjectStageDetails {
  return dto?.map(projectStageDetailFromDTO) || [];
}

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
    canons: dto.type,
  };
}

export function projectFromTableDTO(dto: ProjectTableDTO): Project {
  const stage = dto.stage;
  return {
    uuid: dto.uuid,
    toh: dto.toh,
    title: dto.title,
    stage: {
      label: stage,
      description: STAGE_DESCRIPTIONS[stage] || '',
      date: new Date(dto.publicationDate),
      color: STAGE_COLORS[stage] || 'grey',
    },
    pages: dto.pages,
    notes: dto.notes,
    contractDate: new Date(dto.contractDate),
    contractId: dto.contractId,
    workUuid: dto.workUuid,
    version: dto.version as SemVer,
    translator: dto.mainTranslator,
    translationGroup: dto.translationGroup,
  };
}
