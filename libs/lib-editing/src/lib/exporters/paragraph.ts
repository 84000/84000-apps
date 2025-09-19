import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const paragraph: Exporter<AnnotationExportDTO> = ({ node }) => {
  return {
    type: 'paragraph',
    uuid: node.attrs.uuid,
    textContent: node.textContent,
  };
};
