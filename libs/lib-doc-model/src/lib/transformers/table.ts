import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { tohAttrs } from '../annotation-attrs';

export const table: Transformer = (ctx) => {
  const { annotation } = ctx;
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
