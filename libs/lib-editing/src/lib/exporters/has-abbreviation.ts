import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const hasAbbreviation: Exporter<AnnotationExportDTO> = ({
  node,
  start,
}) => {
  const textContent = node.textContent;
  const abbreviation = node.attrs.abbreviation;
  const uuid = node.attrs.uuid;

  if (!abbreviation || !textContent) {
    console.warn(`Has abbreviation node ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'hasAbbreviation',
    textContent,
    start,
    end: start + textContent.length,
    attrs: {
      abbreviation,
    },
  };
};
