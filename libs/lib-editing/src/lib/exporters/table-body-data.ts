import { TableBodyDataAnnotation } from '@data-access';
import { Exporter } from './export';

export const tableBodyData: Exporter<TableBodyDataAnnotation> = ({
  node,
  start,
  passageUuid,
}): TableBodyDataAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'tableBodyData',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
