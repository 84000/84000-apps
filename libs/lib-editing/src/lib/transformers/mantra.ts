import { MantraAnnotation } from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { markUnplaceable, recurse } from './recurse';

export const mantra: Transformer = (ctx) => {
  const { annotation } = ctx;

  const { lang, uuid } = annotation as MantraAnnotation;
  if (!lang) {
    return;
  }

  const matched = recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) =>
      splitContent({
        ...ctx,
        transform: ({ block: item }) => {
          item.marks = [
            ...(item.marks || []),
            { type: 'mantra', attrs: { uuid, lang } },
          ];
        },
      }),
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
