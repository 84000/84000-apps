import { EndNoteLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitAt } from './split-at';

export const endNoteLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { endNote, uuid, start, end } = annotation as EndNoteLinkAnnotation;

  if (!endNote) {
    console.warn(`End note link ${uuid} is missing end note reference`);
    return;
  }

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitAt({
        ...ctx,
        transform: ({ block }) => {
          block.marks = [
            ...(block.marks || []),
            {
              type: 'endNoteLink',
              attrs: {
                endNote,
                uuid,
                start,
                end,
              },
            },
          ];
        },
      });
    },
  });
};
