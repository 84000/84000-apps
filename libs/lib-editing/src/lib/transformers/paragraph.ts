import { ParagraphAnnotation } from '@eightyfourthousand/data-access';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { recurse } from './recurse';

export const paragraph: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid, align, wordBreak } =
    (annotation as ParagraphAnnotation) || {};

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'paragraph';
          block.attrs = {
            ...block.attrs,
            start,
            end,
            uuid,
            ...(align ? { textAlign: align } : {}),
            ...(wordBreak ? { wordBreak } : {}),
          };
        },
      }),
  });
};
