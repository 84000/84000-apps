import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { recurse } from './recurse';

export const table: Transformer = (ctx) => {
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'table';
          block.attrs = {
            ...block.attrs,
          };
          block.content = [
            {
              type: 'paragraph',
              content: block.content || [],
              attrs: {
                ...block.attrs,
              },
            },
          ];
        },
      }),
  });
};
