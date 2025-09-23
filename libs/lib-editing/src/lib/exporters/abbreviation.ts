import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const abbreviation: Exporter<AnnotationExportDTO> = ({
  node,
  parent,
  start,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  const abbreviation = node.attrs.abbreviation;
  const uuid = node.attrs.uuid;

  if (!abbreviation) {
    console.warn(`Abbreviation ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'abbreviation',
    textContent,
    start,
    end: start + textContent.length,
    attrs: {
      abbreviation,
    },
  };
};
