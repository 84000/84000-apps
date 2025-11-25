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

  const location = start === 0 ? 'start' : 'end';

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitContentAt({
        ...ctx,
        transform: ({ block }) => {
          let endnoteMark = block.marks?.find((m) => m.type === 'endNoteLink');
          const marks = block.marks || [];
          const notes = endnoteMark?.attrs?.notes || [];
          notes.push({
            endNote,
            uuid,
            start,
            end,
            location,
            toh,
          });

          if (endnoteMark) {
            endnoteMark.attrs = endnoteMark.attrs || {};
            endnoteMark.attrs.notes = notes;
          } else {
            endnoteMark = {
              type: 'endNoteLink',
              attrs: {
                notes,
              },
            };
            marks.push(endnoteMark);
          }

          block.marks = [...marks];
        },
      });
    },
  });
};
