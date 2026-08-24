import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

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
            start,
            end,
            uuid,
          };
        },
      });
    },
  });
};
