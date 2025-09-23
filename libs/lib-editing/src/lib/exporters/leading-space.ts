import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const leadingSpace: Exporter<AnnotationExport> = ({
  node,
  parent,
  start,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.leadingSpaceUuid,
    type: 'leadingSpace',
    textContent,
    start,
    end: start,
  };
};
