import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const glossaryInstance: Exporter<AnnotationExportDTO> = ({ node }) => {
  const textContent = node.textContent;
  const glossary = node.attrs.glossary;
  const uuid = node.attrs.uuid;

  if (!textContent || !glossary) {
    console.warn(`Glossary instance ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'glossaryInstance',
    textContent,
    attrs: {
      glossary,
    },
  };
};
