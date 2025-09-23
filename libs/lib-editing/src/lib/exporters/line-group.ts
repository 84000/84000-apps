import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const lineGroup: Exporter<AnnotationExport> = ({ node, start }) => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Line group ${uuid} is empty`);
    return undefined;
  }

  return {
    type: 'lineGroup',
    uuid,
    textContent,
    start,
    end: start + textContent.length,
  };
};
