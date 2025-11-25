import { EndNoteLinkAnnotation } from '@data-access';
import { Exporter } from './export';

export const endNoteLink: Exporter<EndNoteLinkAnnotation[]> = ({
  mark,
  node,
  start,
  passageUuid,
}): EndNoteLinkAnnotation[] => {
  const textContent = node.textContent;
  const notes = mark?.attrs.notes || [];

  if (!textContent || notes.length === 0) {
    console.warn(`Endnote link instance on passage ${passageUuid} incomplete`);
    return [];
  }

  const end = start + textContent.length;
  const annotations: EndNoteLinkAnnotation[] = notes.map(
    (note: { uuid: string; endNote: string }) => {
      const { uuid, endNote } = note;
      return {
        uuid,
        type: 'endNoteLink',
        passageUuid,
        start,
        end,
        endNote,
      };
    },
  );

  return annotations;
};
