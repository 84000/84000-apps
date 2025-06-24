import { Annotations, AnnotationsDTO } from './annotation';

export type BodyItemType =
  | 'abbreviations'
  | 'abbreviationHeader'
  | 'acknowledgment'
  | 'acknowledgmentHeader'
  | 'appendix'
  | 'appendixHeader'
  | 'colophon'
  | 'colophonHeader'
  | 'endnote'
  | 'endnotesHeader'
  | 'homage'
  | 'homageHeader'
  | 'introduction'
  | 'introductionHeader'
  | 'prelude'
  | 'preludeHeader'
  | 'prologue'
  | 'prologueHeader'
  | 'summary'
  | 'summaryHeader'
  | 'translation'
  | 'translationHeader'
  | 'unknown';

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
  work_uuid: string;
  xmlId?: string;
  annotations?: AnnotationsDTO;
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
    workUuid: dto.work_uuid,
    xmlId: dto.xmlId,
    annotations: annotations.filter((a) => a.passageUuid === dto.uuid) || [],
  };
};
