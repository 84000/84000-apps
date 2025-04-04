import { Annotations } from './annotation';

export type BodyItemType =
  | 'acknowledgment'
  | 'acknowledgmentHeader'
  | 'end-note'
  | 'introduction'
  | 'summary'
  | 'summaryHeader'
  | 'toc'
  | 'translation'
  | 'translationHeader'
  | 'unknown';

export type Passage = {
  annotations: Annotations;
  content: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  workUuid: string;
  xmlId?: string;
};

export type PassageDTO = {
  content: string;
  sort: number;
  type: BodyItemType;
  uuid: string;
  work_uuid: string;
  xmlId?: string;
};

export const passageFromDTO = (
  dto: PassageDTO,
  annotations: Annotations = [],
): Passage => {
  return {
    content: dto.content,
    sort: dto.sort,
    type: dto.type,
    uuid: dto.uuid,
    workUuid: dto.work_uuid,
    xmlId: dto.xmlId,
    annotations: annotations.filter((a) => a.passageUuid === dto.uuid) || [],
  };
};
