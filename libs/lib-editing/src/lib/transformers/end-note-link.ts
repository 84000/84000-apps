import { EndNoteLinkAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const endNoteLink: Transformer = ({ block, annotation }) => {
  const endNote = (annotation as EndNoteLinkAnnotation).endNote;
  if (block.type === 'endNoteLink') {
    block.attrs = {
      ...block.attrs,
      endNote,
    };

    return block;
  }

  return scan({
    block,
    annotation,
    transform: (item) => [
      item,
      {
        type: 'endNoteLink',
        attrs: {
          uuid: annotation.uuid,
          endNote,
        },
      },
    ],
  });
};
