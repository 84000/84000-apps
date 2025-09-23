import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const paragraph: Exporter<AnnotationExportDTO> = ({
  node,
  parent,
  start,
}) => {
  const uuid = node.attrs.uuid;
  const parentUuid = parent?.attrs.uuid;

  // NOTE: paragraph are often inserted as structural elements. When this happens,
  // they have the same uuid as their parent. We skip these paragraphs.
  if (uuid === parentUuid) {
    return;
  }

  const textContent = node.textContent || '';
  if (!textContent) {
    console.warn(`Paragraph ${uuid} is empty`);
    return undefined;
  }

  return {
    type: 'paragraph',
    uuid,
    textContent,
    start,
    end: start + textContent.length,
  };
};
