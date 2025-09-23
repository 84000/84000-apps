import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const trailer: Exporter<AnnotationExport> = ({
  node,
  parent,
  start,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.trailerUuid,
    type: 'trailer',
    textContent,
    start,
    end: start + textContent.length,
  };
};
