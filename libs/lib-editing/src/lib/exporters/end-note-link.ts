import { AnnotationExportDTO } from './annotation';
import { Exporter } from './export';

export const endNoteLink: Exporter<AnnotationExportDTO> = ({ node, start }) => {
  const textContent = node.textContent;
  const endNote = node.attrs.endNote;
  const uuid = node.attrs.uuid;

  if (!endNote) {
    console.warn(`Endnote link instance ${uuid} is incomplete`);
    console.log(node.attrs);
    return undefined;
  }

  return {
    uuid,
    type: 'endNoteLink',
    textContent,
    start,
    end: start,
    attrs: {
      endNote,
    },
  };
};
