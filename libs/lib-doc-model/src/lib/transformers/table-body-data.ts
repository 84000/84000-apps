import { recurse } from './recurse';
import { splitBlock } from './split-block';
import type { Transformer } from './transformer';
import { tohAttrs } from '../annotation-attrs';

export const tableBodyData: Transformer = (ctx) => {
  const { annotation } = ctx;
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
            ...tohAttrs(annotation),
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
