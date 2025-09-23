import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const heading: Exporter<AnnotationExport> = ({ node, start }) => {
  const textContent = node.textContent;
  const uuid = node.attrs.uuid;
  const level = (node.attrs.level as number) || 1;
  const cls = node.attrs.class;

  if (!textContent) {
    console.warn(`Heading node ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'heading',
    textContent,
    start,
    end: start + textContent.length,
    attrs: {
      level,
      class: cls,
    },
  };
};
