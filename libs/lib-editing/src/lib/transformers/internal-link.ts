import { InternalLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

// NOTE: over time, internal links become just regular links.
export const internalLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const {
    uuid,
    href = '#',
    start,
    end,
    type,
  } = annotation as InternalLinkAnnotation;

  if (!(end - start)) {
    // If the annotation has no length, we don't need to do anything.
    console.warn(
      `Skipping internal link transformation for annotation with no length: ${uuid}`,
    );
    return;
  }

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
