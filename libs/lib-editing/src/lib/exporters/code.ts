import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const code: Exporter<AnnotationExportDTO> = ({ node, mark, parent }) => {
  const textContent = node.textContent || parent.textContent || '';
  const uuid = mark?.attrs.uuid;

  if (!textContent || !uuid) {
    console.warn(`Code node ${uuid} is missing body text or uuid`);
    return undefined;
  }

  return {
    uuid,
    type: 'code',
    textContent,
  };
};
