import { CommentAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';

export const comment: Exporter<CommentAnnotation> = ({
  mark,
  node,
  start,
  passageUuid,
}): CommentAnnotation | undefined => {
  const textContent = node.textContent;
  const thread = mark?.attrs.comment;
  const uuid = mark?.attrs.uuid;

  if (!textContent || !thread || !uuid) {
    console.warn(`Comment ${uuid} on passage ${passageUuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'comment',
    passageUuid,
    start,
    end: start + textContent.length,
    comment: thread,
  };
};
