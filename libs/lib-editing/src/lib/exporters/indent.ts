import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const indent: Exporter<AnnotationExport> = ({ node, parent, start }) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.indentUuid,
    type: 'indent',
    textContent,
    start,
    end: start + textContent.length,
  };
};
