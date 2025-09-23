import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const line: Exporter<AnnotationExport> = ({ node, start }) => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Line ${uuid} is empty`);
    return undefined;
  }

  return {
    type: 'line',
    uuid,
    textContent,
    start,
    end: start + textContent.length,
  };
};
