import { LinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

export const link: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, href = '#', type } = annotation as LinkAnnotation;

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
              type: 'link',
              attrs: { href, uuid, type },
            },
          ];
        },
      }),
  });
};
