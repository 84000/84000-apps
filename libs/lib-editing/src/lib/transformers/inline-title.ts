import { InlineTitleAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';
import { ITALIC_LANGUAGES } from './annotate';
import { recurse } from './recurse';

export const inlineTitle: Transformer = (ctx) => {
  const { annotation } = ctx;

  const { lang } = annotation as InlineTitleAnnotation;
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
        transform: ({ block }) => {
          block.marks = [...(block.marks || []), { type: markType }];
        },
      }),
  });
};
