import type { Transformer } from './transformer';
import { splitContent } from './split-content';
import { markUnplaceable, recurse } from './recurse';

export const italic: Transformer = (ctx) => {
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
              type: 'italic',
            },
          ];
        },
      }),
  });

  if (!matched) {
    markUnplaceable(ctx.annotation);
  }
};
