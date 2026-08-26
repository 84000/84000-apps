import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { tohAttrs } from '../annotation-attrs';

export const listItem: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'listItem';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
            start,
            end,
            uuid,
          };
          block.content = [
            {
              type: 'paragraph',
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
