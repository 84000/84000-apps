import { Alignment, AlignmentDTO, alignmentsFromDTO } from './alignment';
import {
  Annotations,
  AnnotationsDTO,
  annotationsFromDTO,
  annotationsToDTO,
} from './annotation';
import { TohokuCatalogEntry } from './toh';

export const BODY_ITEM_TYPES = [
  'abbreviations',
  'abbreviationsHeader',
  'acknowledgment',
  'acknowledgmentHeader',
  'appendix',
  'appendixHeader',
  'colophon',
  'colophonHeader',
  'endnotes',
  'endnotesHeader',
  'homage',
  'homageHeader',
  'introduction',
  'introductionHeader',
  'prelude',
  'preludeHeader',
  'prologue',
  'prologueHeader',
  'summary',
  'summaryHeader',
  'translation',
  'translationHeader',
];

export type BodyItemType = (typeof BODY_ITEM_TYPES)[number] | 'unknown';

export const FRONT_MATTER: BodyItemType[] = [
  'acknowledgment',
  'summary',
  'introduction',
];
export const FRONT_MATTER_FILTER = `(${FRONT_MATTER.join('|')})`;
export const BODY_MATTER: BodyItemType[] = [
  'prelude',
  'prologue',
  'translation',
  'appendix',
  'colophon',
  'homage',
];
export const BODY_MATTER_FILTER = `(${BODY_MATTER.join('|')})`;
export const BACK_MATTER: BodyItemType[] = ['abbreviations', 'endnotes'];
export const BACK_MATTER_FILTER = `(${BACK_MATTER.join('|')})`;
export const COMPARE_MODE = BODY_MATTER;
export const COMPARE_MODE_FILTER = `(${COMPARE_MODE.join('|')})`;

export const PANEL_FILTERS = [
  FRONT_MATTER_FILTER,
  BODY_MATTER_FILTER,
  BACK_MATTER_FILTER,
  COMPARE_MODE_FILTER,
] as const;

export type PanelFilter = (typeof PANEL_FILTERS)[number];

export type Passage = {
  alignments?: Alignment[];
  annotations: Annotations;
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  workUuid: string;
  xmlId?: string;
  parent?: string;
  toh?: TohokuCatalogEntry;
  references?: Passages;
};

export type Passages = Passage[];

export type PassageRowDTO = {
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  work_uuid: string;
  xmlId?: string;
  parent?: string;
  toh?: TohokuCatalogEntry;
};

export type PassageDTO = PassageRowDTO & {
  alignments?: AlignmentDTO[];
  annotations?: AnnotationsDTO | null;
};

export type PaginationDirection = 'forward' | 'backward';

export type PassagesPageDTO = {
  passages: PassageDTO[];
  nextCursor?: string;
  hasMore: boolean;
};

export type PassagesPageAroundDTO = {
  passages: PassageDTO[];
  prevCursor?: string;
  nextCursor?: string;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

export type PassagesPage = {
  passages: Passage[];
  prevCursor?: string;
  nextCursor?: string;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

export const passageFromDTO = (
  dto: PassageDTO,
  annotations: Annotations = [],
  alignments: Alignment[] = [],
): Passage => {
  return {
    content: dto.content,
    label: dto.label,
    sort: dto.sort,
    type: dto.type,
    uuid: dto.uuid,
    workUuid: dto.work_uuid,
    xmlId: dto.xmlId,
    parent: dto.parent,
    toh: dto.toh,
    alignments,
    annotations,
  };
};

export const passagesFromDTO = (dto: PassageDTO[]): Passage[] => {
  return dto.map((p) =>
    passageFromDTO(
      p,
      annotationsFromDTO(p.annotations || [], p.content.length),
      alignmentsFromDTO(p.alignments || []),
    ),
  );
};

export const passageToRowDTO = (passage: Passage): PassageRowDTO => {
  const dto: PassageRowDTO = {
    content: passage.content,
    label: passage.label,
    sort: passage.sort,
    type: passage.type,
    uuid: passage.uuid,
    work_uuid: passage.workUuid,
  };

  // NOTE: only include xmlId and parent if they exist, otherwise an upsert
  // will set them to null in the database.
  if (passage.xmlId) {
    dto.xmlId = passage.xmlId;
  }

  if (passage.parent) {
    dto.parent = passage.parent;
  }

  if (passage.toh) {
    dto.toh = passage.toh;
  }

  return dto;
};

export const passageToDTO = (passage: Passage): PassageDTO => {
  // NOTE: ignore alignments
  return {
    ...passageToRowDTO(passage),
    annotations: annotationsToDTO(passage.annotations) || [],
  };
};

export const passagesToDTO = (passages: Passage[]): PassageDTO[] => {
  return passages.map(passageToDTO);
};

export const passagesToRowDTO = (passages: Passage[]): PassageRowDTO[] => {
  return passages.map(passageToRowDTO);
};

export const passagesPageFromDTO = (
  direction: PaginationDirection,
  dto: PassagesPageDTO,
): PassagesPage => {
  return {
    passages: passagesFromDTO(dto.passages),
    nextCursor: direction === 'forward' ? dto.nextCursor : undefined,
    prevCursor: direction === 'backward' ? dto.nextCursor : undefined,
    hasMoreAfter: direction === 'forward' && dto.hasMore,
    hasMoreBefore: direction === 'backward' && dto.hasMore,
  };
};

export const passagesPageAroundFromDTO = (
  dto: PassagesPageAroundDTO,
): PassagesPage => {
  return {
    passages: passagesFromDTO(dto.passages),
    nextCursor: dto.nextCursor,
    prevCursor: dto.prevCursor,
    hasMoreAfter: dto.hasMoreAfter,
    hasMoreBefore: dto.hasMoreBefore,
  };
};
