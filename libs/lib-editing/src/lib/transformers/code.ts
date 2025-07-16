import type { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

export const code: Transformer = (ctx) => {
  recurse({
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
            },
          ];
        },
      }),
  });
};
