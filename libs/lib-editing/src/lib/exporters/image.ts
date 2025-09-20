import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const image: Exporter<AnnotationExportDTO> = ({ node, parent }) => {
  const textContent = node.textContent || parent.textContent || '';
  const src = node.attrs.src;
  const uuid = node.attrs.uuid;

  if (!src) {
    console.warn(`Image node ${uuid} is missing src attribute`);
    return undefined;
  }

  return {
    uuid,
    type: 'image',
    textContent,
    attrs: {
      src,
    },
  };
};
