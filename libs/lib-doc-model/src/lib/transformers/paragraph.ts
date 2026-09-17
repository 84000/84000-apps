import { ParagraphAnnotation } from '@eightyfourthousand/data-access';
import { insertBlockAt } from './insert-block';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { tohAttrs } from '../annotation-attrs';

export const paragraph: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid, align, wordBreak } =
    (annotation as ParagraphAnnotation) || {};

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) => {
      // As with `line`, a zero-length paragraph holds only inline atoms and is
      // placed as an empty sibling rather than split.
      if (start === end) {
        insertBlockAt(ctx);
        return;
      }

      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'paragraph';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
            start,
            end,
            uuid,
            ...(align ? { textAlign: align } : {}),
            ...(wordBreak ? { wordBreak } : {}),
          };
        },
      });
    },
  });
};
