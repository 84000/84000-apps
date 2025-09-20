import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const heading: Exporter<AnnotationExportDTO> = ({ node }) => {
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
    attrs: {
      level,
      class: cls,
    },
  };
};
