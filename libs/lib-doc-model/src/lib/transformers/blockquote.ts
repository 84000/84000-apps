import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const blockquote: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  recurse({
    ...ctx,
    until: ['paragraph', 'lineGroup'],
    transform: (ctx) => {
      const origType = ctx.block?.type || 'paragraph';
      splitBlock({
        ...ctx,
        transform: (ctx) => {
          const { block } = ctx;
          block.type = 'blockquote';
          block.attrs = {
            ...block.attrs,
            start,
            end,
            uuid,
          };
          block.content = [
            {
              type: origType,
              attrs: {
                ...block.attrs,
                start,
                end,
                uuid,
              },
              content: block.content || [],
            },
          ];
        },
      });
    },
  });
};
