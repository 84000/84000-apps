import { InlineTitleAnnotation } from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES } from './annotate';
import { markUnplaceable, recurse } from './recurse';
import { tohAttrs } from '../annotation-attrs';

export const inlineTitle: Transformer = (ctx) => {
  const { annotation } = ctx;

  const { lang, uuid } = annotation as InlineTitleAnnotation;
  if (!lang) {
    return;
  }

  // Titles in languages not set in italics (e.g. zh, ja) get their own
  // upright mark, so they are kept rather than dropped.
  const markType = ITALIC_LANGUAGES.includes(lang) ? 'italic' : 'inlineTitle';

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
              type: markType,
              attrs: {
                ...tohAttrs(annotation),
                uuid,
                lang,
                type: 'inlineTitle',
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
