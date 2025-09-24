import { Annotations, AnnotationsDTO } from './annotation';

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

export type PassageDTO = {
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  workUuid: string;
  xmlId?: string;
  parent?: string;
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
