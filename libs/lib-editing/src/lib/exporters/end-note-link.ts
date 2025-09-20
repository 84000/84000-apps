import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const endNoteLink: Exporter<AnnotationExportDTO> = ({ node }) => {
  const textContent = node.textContent;
  const endNote = node.attrs.endNote;
  const uuid = node.attrs.uuid;

  if (!textContent || !endNote) {
    console.warn(`Endnote link instance ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'endNoteLink',
    textContent,
    attrs: {
      endNote,
    },
  };
};
