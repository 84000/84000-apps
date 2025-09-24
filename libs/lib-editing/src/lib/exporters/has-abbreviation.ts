import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const hasAbbreviation: Exporter<AnnotationExport> = ({
  node,
  start,
}) => {
  const textContent = node.textContent;
  const abbreviation = node.attrs.abbreviation;
  const uuid = node.attrs.uuid;

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
