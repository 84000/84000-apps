import { ListAnnotation } from '@data-access';
import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const list: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid, nesting, spacing, itemStyle } =
    (annotation as ListAnnotation) || {};

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'bulletList';
          block.attrs = {
            ...block.attrs,
            nesting,
            spacing,
            itemStyle,
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
