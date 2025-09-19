import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const trailer: Exporter<AnnotationExportDTO> = ({ node, parent }) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.trailerUuid,
    type: 'trailer',
    textContent,
  };
};
