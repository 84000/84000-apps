import { CodeAnnotation } from '@data-access';
import { Exporter } from './export';

export const code: Exporter<CodeAnnotation> = ({
  node,
  mark,
  parent,
  start,
  passageUuid,
}): CodeAnnotation | undefined => {
  const textContent = node.textContent || parent.textContent || '';
  const uuid = mark?.attrs.uuid;

  if (!textContent || !uuid) {
    console.warn(`Code node ${uuid} is missing body text or uuid`);
    return undefined;
  }

  return {
    uuid,
    type: 'code',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
