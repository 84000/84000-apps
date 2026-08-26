import type { Transformer } from './transformer';
import { splitContent } from './split-content';
import { markUnplaceable, recurse } from './recurse';
import { tohAttrs } from '../annotation-attrs';

export const code: Transformer = (ctx) => {
  const { annotation } = ctx;
  const matched = recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) =>
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.marks = [
            ...(block.marks || []),
            {
              type: 'code',
              attrs: { ...tohAttrs(annotation), uuid: annotation.uuid },
            },
          ];
        },
      }),
  });

  if (!matched) {
    markUnplaceable(ctx.annotation);
  }
};
