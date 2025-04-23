export type ProjectStageLabel =
  | '0'
  | '1'
  | '1.a'
  | '2'
  | '2.a'
  | '2.b'
  | '2.c'
  | '2.d'
  | '2.e'
  | '2.f'
  | '2.g'
  | '2.h'
  | '3'
  | '4';

const STAGE_DESCRIPTIONS: Record<ProjectStageLabel, string> = {
  '0': 'Not started',
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
};

// TODO: use real theme colors
const STAGE_COLORS: Record<ProjectStageLabel, string> = {
  '0': 'bg-muted text-muted-foreground',
  '1': 'bg-emerald',
  '1.a': 'bg-emerald',
  '2': 'bg-ochre',
  '2.a': 'bg-ochre',
  '2.b': 'bg-ochre',
  '2.c': 'bg-ochre',
  '2.d': 'bg-ochre',
  '2.e': 'bg-ochre',
  '2.f': 'bg-ochre',
  '2.g': 'bg-ochre',
  '2.h': 'bg-ochre',
  '3': 'bg-navy',
  '4': 'bg-brick',
};

export type ProjectStage = {
  label: ProjectStageLabel;
  description: string;
  date: Date;
  color: string;
};

export type ProjectDTO = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: ProjectStageLabel;
  stage_date: string;
  pages: number;
};

export type Project = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: ProjectStage;
  pages: number;
};

export function projectFromDTO(dto: ProjectDTO): Project {
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
