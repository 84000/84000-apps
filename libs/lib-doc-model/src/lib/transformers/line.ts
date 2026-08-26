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
