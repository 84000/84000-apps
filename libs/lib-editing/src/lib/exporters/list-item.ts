import { ListItemAnnotation } from '@data-access';
import { Exporter } from './export';

export const listItem: Exporter<ListItemAnnotation> = ({
  node,
  start,
  passageUuid,
}): ListItemAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'listItem',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
