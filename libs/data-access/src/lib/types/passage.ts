import {
  Annotations,
  AnnotationsDTO,
  annotationsFromDTO,
  annotationsToDTO,
} from './annotation';

export const BODY_ITEM_TYPES = [
  'abbreviations',
  'abbreviationsHeader',
  'acknowledgment',
  'acknowledgmentHeader',
  'appendix',
  'appendixHeader',
  'colophon',
  'colophonHeader',
  'endnote',
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

export type Passage = {
  annotations: Annotations;
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  workUuid: string;
  xmlId?: string;
};

export type PassageRowDTO = {
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  workUuid: string;
  xmlId?: string;
  parent?: string;
};

export type PassageDTO = PassageRowDTO & {
  annotations?: AnnotationsDTO | null;
};

export const passageFromDTO = (
  dto: PassageDTO,
  annotations: Annotations = [],
): Passage => {
  return {
    content: dto.content,
    label: dto.label,
    sort: dto.sort,
    type: dto.type,
    uuid: dto.uuid,
    workUuid: dto.workUuid,
    xmlId: dto.xmlId,
    annotations: annotations.filter((a) => a.passageUuid === dto.uuid) || [],
  };
};

export const passagesFromDTO = (dto: PassageDTO[]): Passage[] => {
  return dto.map((p) =>
    passageFromDTO(p, annotationsFromDTO(p.annotations || [])),
  );
};

export const passageToRowDTO = (passage: Passage): PassageRowDTO => {
  return {
    content: passage.content,
    label: passage.label,
    sort: passage.sort,
    type: passage.type,
    uuid: passage.uuid,
    workUuid: passage.workUuid,
    xmlId: passage.xmlId,
  };
};

export const passageToDTO = (passage: Passage): PassageDTO => {
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
