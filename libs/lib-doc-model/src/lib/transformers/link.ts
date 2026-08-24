import { LinkAnnotation } from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { markUnplaceable, recurse } from './recurse';

export const link: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, href = '#', type } = annotation as LinkAnnotation;

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
              type: 'link',
              attrs: { href, uuid, type },
            },
          ];
        },
      }),
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
