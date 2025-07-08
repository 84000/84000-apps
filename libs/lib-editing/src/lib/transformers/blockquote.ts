import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const blockquote: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { start, end, uuid } = annotation || {};

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'blockquote';
          block.attrs = {
            ...block.attrs,
            start,
            end,
            uuid,
          };
          block.content = [
            {
              type: 'paragraph',
              content: block.content || [],
            },
          ];
        },
      }),
  });
};
