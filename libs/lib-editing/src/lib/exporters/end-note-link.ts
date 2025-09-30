import { EndNoteLinkAnnotation } from '@data-access';
import { Exporter } from './export';

export const endNoteLink: Exporter<EndNoteLinkAnnotation> = ({
  node,
  start,
  passageUuid,
}): EndNoteLinkAnnotation | undefined => {
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
    passageUuid,
    start,
    end: start,
    endNote,
  };
};
