import {
  CommentAnnotation,
  serializeTohList,
} from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { markUnplaceable, recurse } from './recurse';
import { splitContent } from './split-content';

/**
 * Renders a comment anchor as a `comment` mark carrying the thread root's uuid.
 *
 * The mark's own `uuid` is the anchor's identity — the `passage_annotations` row
 * it exports back to — while `comment` points at `comments.uuid`.
 */
export const comment: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, comment: thread, toh } = annotation as CommentAnnotation;

  if (!thread) {
    console.warn(`Comment ${uuid} is missing thread UUID`);

    return;
  }

  const matched = recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: (ctx) => {
          const { block } = ctx;
          block.marks = [
            ...(block.marks || []),
            {
              type: 'comment',
              attrs: {
                comment: thread,
                uuid,
                toh: serializeTohList(toh),
              },
            },
          ];
        },
      });
    },
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
