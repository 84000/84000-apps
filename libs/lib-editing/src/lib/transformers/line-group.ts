import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

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
