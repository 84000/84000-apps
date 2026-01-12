import { EndNoteLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitContentAt } from './split-at';
import { splitContent } from './split-content';

const innerTransform: Transformer = ({ block, annotation }) => {
  const { endNote, label, uuid, start, end, toh } =
    annotation as EndNoteLinkAnnotation;
  let endnoteMark = block.marks?.find((m) => m.type === 'endNoteLink');
  const marks = block.marks || [];
  const notes = endnoteMark?.attrs?.notes || [];
  notes.push({
    endNote,
    label,
    uuid,
    start,
    end,
    location: end === 0 ? 'start' : 'end',
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
};

export const endNoteLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { endNote, uuid, end } = annotation as EndNoteLinkAnnotation;

  if (!endNote) {
    console.warn(`End note link ${uuid} is missing end note reference`);
    return;
  }

  const isStart = end === 0;

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      if (isStart) {
        splitContent({
          ...ctx,
          annotation: {
            ...annotation,
            end: 1,
          },
          transform: ({ block }) => {
            innerTransform({ ...ctx, block });
          },
        });
        return;
      }

      splitContentAt({
        ...ctx,
        transform: ({ block }) => {
          innerTransform({ ...ctx, block });
        },
      });
    },
  });
};
