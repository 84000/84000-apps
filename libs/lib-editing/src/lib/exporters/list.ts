import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const list: Exporter<AnnotationExport> = ({ node, start }) => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List ${uuid} is empty`);
    return undefined;
  }

  const spacing = node.attrs.spacing;
  const nesting = (node.attrs.nesting as number) || 0;
  const itemStyle = node.attrs.itemStyle;

  return {
    type: 'list',
    uuid,
    textContent,
    start,
    end: start + textContent.length,
    attrs: { spacing, nesting, itemStyle },
  };
};
