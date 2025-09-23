import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const indent: Exporter<AnnotationExportDTO> = ({
  node,
  parent,
  start,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.indentUuid,
    type: 'indent',
    textContent,
    start,
    end: start + textContent.length,
  };
};
