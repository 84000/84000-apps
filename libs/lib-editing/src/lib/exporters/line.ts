import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const line: Exporter<AnnotationExportDTO> = ({ node }) => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Line ${uuid} is empty`);
    return undefined;
  }

  return {
    type: 'line',
    uuid,
    textContent,
  };
};
