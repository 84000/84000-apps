import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const blockquote: Exporter<AnnotationExport> = ({ node, start }) => {
  const textContent = node.textContent;
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Blockquote node ${uuid} is missing body text`);
    return undefined;
  }

  return {
    uuid,
    type: 'blockquote',
    textContent,
    start,
    end: start + textContent.length,
  };
};
