import { InternalLinkAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

// NOTE: over time, internal links become just regular links.
export const internalLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const {
    entity,
    href = '#',
    start,
    end,
    linkType: type,
  } = annotation as InternalLinkAnnotation;

  if (!(end - start)) {
    // If the annotation has no length, we don't need to do anything.
    console.warn(
      `Skipping internal link transformation for annotation with no length: ${entity}`,
    );
    return;
  }

  // NOTE: we use redirects to forward older urls. Hashes aren't passed to the
  // api, so make an effort to convert them to query params.
  let path = href.replace('#', '?xmlId=');

  if (type && entity) {
    path = `/entity/${type}/${entity}`;
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
              attrs: { href: path, entity, type },
            },
          ];
        },
      }),
  });
};
