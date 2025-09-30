import { TableBodyRowAnnotation } from '@data-access';
import { Exporter } from './export';

export const tableBodyRow: Exporter<TableBodyRowAnnotation> = ({
  node,
  start,
  passageUuid,
}): TableBodyRowAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'tableBodyRow',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
