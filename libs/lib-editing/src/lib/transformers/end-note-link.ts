import { EndNoteLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';

export const endNoteLink: Transformer = ({ block, annotation }) => {
  const endNote = (annotation as EndNoteLinkAnnotation).endNote;
  if (block.type === 'endNoteLink') {
    block.attrs = {
      ...block.attrs,
      endNote,
    };

    return;
  }

  splitContent({
    block,
    annotation,
    transform: () => [
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
