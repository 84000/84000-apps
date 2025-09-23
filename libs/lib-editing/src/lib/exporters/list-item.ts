import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const listItem: Exporter<AnnotationExport> = ({ node, start }) => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    type: 'listItem',
    uuid,
    textContent,
    start,
    end: start + textContent.length,
  };
};
