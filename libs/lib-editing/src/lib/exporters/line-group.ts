import { LineGroupAnnotation } from '@data-access';
import { Exporter } from './export';

export const lineGroup: Exporter<LineGroupAnnotation> = ({
  node,
  start,
  passageUuid,
}): LineGroupAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Line group ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'lineGroup',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
