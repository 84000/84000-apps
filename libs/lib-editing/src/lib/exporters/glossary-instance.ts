import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const glossaryInstance: Exporter<AnnotationExportDTO> = ({
  node,
  start,
}) => {
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
    start,
    end: start + textContent.length,
    attrs: {
      glossary,
    },
  };
};
