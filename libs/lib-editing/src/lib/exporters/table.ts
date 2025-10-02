import { TableAnnotation } from '@data-access';
import { Exporter } from './export';

export const table: Exporter<TableAnnotation> = ({
  node,
  start,
  passageUuid,
}): TableAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Table ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'table',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
