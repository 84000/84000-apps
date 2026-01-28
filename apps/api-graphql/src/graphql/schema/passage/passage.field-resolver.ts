import { blockFromPassage } from '@lib-editing';
import {
  annotationsFromDTO,
  alignmentsFromDTO,
  type Passage as DataAccessPassage,
  type BodyItemType,
} from '@data-access';
import type { PassageParent } from './passage.resolver';

export const passageJsonResolver = (parent: PassageParent) => {
  const passage: DataAccessPassage = {
    uuid: parent.uuid,
    content: parent.content,
    label: parent.label,
    sort: parent.sort,
    type: parent.type as BodyItemType,
    workUuid: '',
    xmlId: parent.xmlId ?? undefined,
    annotations: annotationsFromDTO(
      parent._rawAnnotations,
      parent.content.length,
    ),
    alignments: alignmentsFromDTO(parent._rawAlignments),
  };

  return blockFromPassage(passage);
};
