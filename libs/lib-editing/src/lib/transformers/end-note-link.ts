import { EndNoteLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

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
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'endNoteLink';
          block.marks = [];
          block.attrs = {
            ...block.attrs,
            endNote,
            uuid,
            start,
            end,
          };
        },
      });
    },
  });
};
