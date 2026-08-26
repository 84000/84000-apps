import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { tohAttrs } from '../annotation-attrs';

export const trailer: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'trailer';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
            start,
            end,
            uuid,
          };
        },
      }),
  });
};
