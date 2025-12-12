import { MantraAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { recurse } from './recurse';

export const mantra: Transformer = (ctx) => {
  const { annotation } = ctx;

  const { lang, uuid } = annotation as MantraAnnotation;
  if (!lang) {
    return;
  }

  recurse({
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
};
