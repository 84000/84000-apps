import { EndNoteLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitContentAt } from './split-at';

export const endNoteLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { endNote, uuid, start, end, toh } =
    annotation as EndNoteLinkAnnotation;

  if (!endNote) {
    console.warn(`End note link ${uuid} is missing end note reference`);
    return;
  }

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitContentAt({
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
                toh,
              },
            },
          ];
        },
      });
    },
  });
};
