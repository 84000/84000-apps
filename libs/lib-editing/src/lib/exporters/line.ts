import { LineAnnotation } from '@data-access';
import { Exporter } from './export';

export const line: Exporter<LineAnnotation> = ({
  node,
  start,
  passageUuid,
}): LineAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Line ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'line',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
