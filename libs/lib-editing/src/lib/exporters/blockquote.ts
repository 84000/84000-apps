import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const blockquote: Exporter<AnnotationExportDTO> = ({ node }) => {
  const textContent = node.textContent;
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Blockquote node ${uuid} is missing body text`);
    return undefined;
  }

  return {
    uuid,
    type: 'blockquote',
    textContent,
  };
};
