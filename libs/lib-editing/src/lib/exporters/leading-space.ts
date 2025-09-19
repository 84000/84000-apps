import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const leadingSpace: Exporter<AnnotationExportDTO> = ({
  node,
  parent,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.leadingSpaceUuid,
    type: 'leadingSpace',
    textContent,
  };
};
