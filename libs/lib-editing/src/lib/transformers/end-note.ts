import { EndNoteAnnotation } from '@data-access';
import { Transformer } from './transformer';

export const endNote: Transformer = ({ block, annotation }) => {
  const content = block.content || [];
  content.push({
    // TODO: figure out index, likely by creating a custom mark type instead
    // of appending text.
    type: 'text',
    text: '*',
    marks: [
      {
        type: 'link',
        attrs: {
          href: (annotation as EndNoteAnnotation).endNoteUuid || '#',
        },
      },
    ],
  });

  return block;
};
