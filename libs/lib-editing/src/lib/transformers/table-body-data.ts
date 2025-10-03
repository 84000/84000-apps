import { recurse } from './recurse';
import { splitBlock } from './split-block';
import type { Transformer } from './transformer';

export const tableBodyData: Transformer = (ctx) => {
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'tableCell';
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
