import { EndNoteLinkAnnotation } from '@data-access';
import { Exporter } from './export';

export const endNoteLink: Exporter<EndNoteLinkAnnotation> = ({
  mark,
  node,
  start,
  passageUuid,
}): EndNoteLinkAnnotation | undefined => {
  const textContent = node.textContent;
  const endNote = mark?.attrs.endNote;
  const uuid = mark?.attrs.uuid;

  if (!textContent || !endNote || !uuid) {
    console.warn(
      `Endnote link instance ${uuid} is on passage ${passageUuid} incomplete`,
    );
    return undefined;
  }

  const end = start + textContent.length;

  return {
    uuid,
    type: 'endNoteLink',
    passageUuid,
    start: end,
    end,
    endNote,
  };
};
