import {
  InternalLinkAnnotation,
  serializeTohList,
} from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { markUnplaceable, recurse } from './recurse';

// NOTE: over time, internal links become just regular links.
export const internalLink: Transformer = (ctx) => {
  const { annotation } = ctx;
  const {
    uuid,
    entity,
    href,
    start,
    end,
    linkType: type,
    toh,
    label,
    linkStatus,
    isPending,
    isSameWork,
    subtype,
    linkToh,
  } = annotation as InternalLinkAnnotation;

  if (!(end - start)) {
    // If the annotation has no length, we don't need to do anything.
    console.warn(
      `Skipping internal link transformation for annotation with no length`,
      annotation,
    );
    return;
  }

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
              type: 'internalLink',
              attrs: {
                uuid,
                // The stored href, kept as is so a save writes it back;
                // `internalLinkPath` derives the URL to navigate to.
                href,
                entity,
                type,
                toh: serializeTohList(toh),
                label,
                linkStatus: linkStatus ?? (isPending ? 'pending' : undefined),
                isSameWork,
                subtype,
                linkToh,
              },
            },
          ];
        },
      }),
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
