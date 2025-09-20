import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const list: Exporter<AnnotationExportDTO> = ({ node }) => {
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
    attrs: { spacing, nesting, itemStyle },
  };
};
