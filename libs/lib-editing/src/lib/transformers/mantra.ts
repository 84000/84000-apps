import { MantraAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES } from './annotate';
import { recurse } from './recurse';

export const mantra: Transformer = (ctx) => {
  const { annotation } = ctx;

  const { lang, uuid } = annotation as MantraAnnotation;
  if (!lang) {
    return;
  }

  const markType = ITALIC_LANGUAGES.includes(lang) ? 'italic' : undefined;
  if (!markType) {
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
            { type: markType, attrs: { uuid, lang, type: 'mantra' } },
          ];
        },
      }),
  });
};
