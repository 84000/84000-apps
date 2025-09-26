import { TableBodyHeaderAnnotation } from '@data-access';
import { Exporter } from './export';

export const tableBodyHeader: Exporter<TableBodyHeaderAnnotation> = ({
  node,
  start,
  passageUuid,
}): TableBodyHeaderAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'tableBodyHeader',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
