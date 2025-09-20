import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const audio: Exporter<AnnotationExportDTO> = ({ node, parent }) => {
  const textContent = node.textContent || parent.textContent || '';
  const uuid = node.attrs.uuid;
  const src = node.attrs.src;
  const mediaType = node.attrs.mediaType || 'audio/mpeg';

  if (!src) {
    console.warn(`Audio node ${uuid} is missing src attribute`);
    return undefined;
  }

  return {
    uuid,
    type: 'audio',
    textContent,
    attrs: {
      src,
      mediaType,
    },
  };
};
