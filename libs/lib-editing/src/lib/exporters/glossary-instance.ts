import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const glossaryInstance: Exporter<AnnotationExportDTO> = ({ node }) => {
  const textContent = node.textContent;
  const glossary = node.attrs.glossary;

  if (!textContent || !glossary) {
    return undefined;
  }

  return {
    uuid: node.attrs.uuid,
    type: 'glossaryInstance',
    textContent,
    attrs: {
      glossary,
    },
  };
};
