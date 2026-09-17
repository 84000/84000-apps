import { insertBlockAt } from './insert-block';
import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { tohAttrs } from '../annotation-attrs';

export const line: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  return recurse({
    ...ctx,
    until: ['line'],
    transform: (ctx) => {
      // A zero-length line holds only inline atoms — a folio reference on its
      // own line — so there is no text to split: place it as an empty sibling.
      if (start === end) {
        insertBlockAt(ctx);
        return;
      }

      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'line';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
            start,
            end,
            uuid,
          };
        },
      });
    },
  });
};
