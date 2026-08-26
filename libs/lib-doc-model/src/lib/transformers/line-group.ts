import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { tohAttrs } from '../annotation-attrs';

export const lineGroup: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  return recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'lineGroup';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
            start,
            end,
            uuid,
          };
          block.content = [
            {
              type: 'line',
              content: block.content || [],
              attrs: {
                start,
                end,
                uuid,
              },
            },
          ];
        },
      }),
  });
};
