import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const listItem: Exporter<AnnotationExportDTO> = ({ node }) => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    type: 'listItem',
    uuid,
    textContent,
  };
};
