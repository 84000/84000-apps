import { InternalLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

// NOTE: over time, internal links become just regular links.
export const internalLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, href = '#' } = annotation as InternalLinkAnnotation;

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
              attrs: { href, uuid },
            },
          ];
        },
      }),
  });
};
