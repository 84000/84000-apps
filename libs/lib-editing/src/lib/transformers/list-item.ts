import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const listItem: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  recurse({
    ...ctx,
    until: ['listItem'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          const content = block.content || [];
          block.type = 'listItem';
          block.attrs = {
            ...block.attrs,
            start,
            end,
            uuid,
          };
          block.content = [
            {
              type: 'paragraph',
              content,
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
